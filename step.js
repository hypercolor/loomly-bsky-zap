
// Zapier environment provides the following variables:
// * inputData
// * fetch
// * output
// * callback

// ORIGINAL STEP 1

const url = 'https://bsky.social/xrpc/com.atproto.server.createSession';
const secondUrl = 'https://bsky.social/xrpc/com.atproto.repo.createRecord';

const data = {
  identifier: inputData['username'],
  password: inputData['password']
};

const postText = inputData['post_text'];
const postImageURL = inputData['post_image_url'];
const postImageMimeType = inputData['post_image_mime_type'];

const returnError = (message) => {
  output = {
    success: false,
    message: message
  };
}

const returnSuccess = (message) => {
  output = {
    success: true,
    message: message
  };
}

const response = await fetch(url, {
  method: 'POST',
  body: JSON.stringify(data),  // Sending the data as a JSON string
  headers: {
    'Content-Type': 'application/json' // Use JSON content type
  },
  redirect: 'manual'
});

// Check if the response status is OK
if (!response.ok) {
  console.error('Failed request', await response.text());
  returnError('Failed to authenticate');
  return;
}

const responseBody = await response.json(); // Parse the JSON response

if (!responseBody.accessJwt) {
  console.error('accessJwt not found in the response');
  returnError('Failed to authenticate, no jwt');
  return;
}

// output = { accessJwt: responseBody.accessJwt };
const authToken = responseBody.accessJwt;


// ORIGINAL STEP 2

// const authToken = inputData['token'];

const parseFacets = async (text) => {
  const facets = [];

  const parseMentions = (text) => {
    const spans = [];
    // regex based on: https://atproto.com/specs/handle#handle-identifier-syntax
    const mentionRegex = /[$|\W](@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)/g;
    const matches = text.matchAll(mentionRegex);

    for (const match of matches) {
      spans.push({
        start: match.index + 1,
        end: match.index + match[0].length,
        handle: match[1].substring(1),
      });
    }

    return spans;
  };

  const parseURLs = (text) => {
    const spans = [];
    // partial/naive URL regex based on: https://stackoverflow.com/a/3809435
    // tweaked to disallow some trailing punctuation
    const urlRegex = /[$|\W](https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*[-a-zA-Z0-9@%_\+~#//=])?)/g;
    const matches = text.matchAll(urlRegex);

    for (const match of matches) {
      spans.push({
        start: match.index + 1,
        end: match.index + match[0].length,
        url: match[1],
      });
    }

    return spans;
  };

  const resolveHandle = async (handle) => {
    const url = `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`;

    try {
      const response = await fetch(url);
      const jsonData = await response.json();
      return jsonData;
    } catch (error) {
      console.error(error);
      returnError('Failed to resolve handle: ' + handle);
      return;
    }
  };

  for (const m of parseMentions(text)) {
    try {
      const response = await resolveHandle(m.handle);
      const did = response.did;

      facets.push({
        index: {
          byteStart: m.start,
          byteEnd: m.end,
        },
        features: [
          { $type: "app.bsky.richtext.facet#mention", did: did },
        ],
      });
    } catch (error) {
      if (error.status && error.status === 400) {
        // If the handle can't be resolved, just skip it!
        // It will be rendered as text in the post instead of a link
        continue;
      } else {
        console.error(error);
      }
    }
  }

  for (const u of parseURLs(text)) {
    facets.push({
      index: {
        byteStart: u.start,
        byteEnd: u.end,
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri: u.url,
        },
      ],
    });
  }

  return facets;
};

const imageUrlToBlob = async (imageUrl, altText) => {
  try {
    const responseFetch = await fetch(imageUrl);
    if (!responseFetch.ok) {
      // Handle non-successful response (e.g., image not found)
      console.error('Image not found. Status:', response.status);
      returnError('Image not found: ' + response.status);
      return null;
    }

    const imgBytes = await responseFetch.buffer();
    if (imgBytes.length > 1000000) {
      console.error('Image file size too large. Maximum 1 megabyte (1000000 bytes), got: ' + imgBytes.length);
      returnError('Image file size too large. Maximum 1 megabyte (1000000 bytes), got: ' + imgBytes.length);
      return null;
    }

    // Perform the upload
    const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
      method: 'POST',
      headers: {
        'Content-Type': postImageMimeType,
        'Authorization': 'Bearer ' + authToken,
      },
      body: imgBytes,
    });

    if (!response.ok) {
      console.error('Failed to upload image. Status', response.status);
      returnError('Failed to upload image. Status: ' + response.status);
      return null;
    }

    const result = await response.json();
    const blob = result.blob;

    return {
      $type: "app.bsky.embed.images",
      images: [
        {
          alt: altText,
          image: blob,
        },
      ],
    };
  } catch (error) {
    console.error('Error converting image to Blob:', error);
    returnError('Error converting image to Blob: ' + error);
    return null;
  }
};

const recordData = {
  "$type": "app.bsky.feed.post",
  "text": postText,
  "createdAt": new Date().toISOString(),
};

const facets = await parseFacets(postText);
if (facets) {
  recordData.facets = facets;
}

const embed = await imageUrlToBlob(postImageURL, postText.slice(0, 50) + '...');
if (embed) {
  recordData.embed = embed;
} else {
  returnError('Failed to convert image to Blob');
  return;
}

const postData = {
  repo: inputData['username'],
  collection: 'app.bsky.feed.post',
  record: recordData
};

const postResponse = await fetch(secondUrl, {
  method: 'POST',
  body: JSON.stringify(postData),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  }
});

if (!postResponse.ok) {
  console.error('Failed request', await postResponse.text());
  returnError('Failed to create record');
  return;
}

const postResponseBody = await postResponse.json();
//console.log('Actual JSON response:', postResponseBody);
if (postResponseBody.cid) {
  output = {
    success: true,
    cid: postResponseBody.cid
  };
  returnSuccess('Record created successfully');
  return;
}
else {
  console.error('Failed to create record', postResponseBody.message);
  returnError('Failed to create record: ' + postResponseBody.message);
  return;
}
