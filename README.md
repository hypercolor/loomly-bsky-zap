# loomly-bsky-zap

This is a single-step Zapier integration that allows you to create a new post in Bluesky from a custom Loomly Channel.

Based on @marisadotdev's [Two-Step Zap](https://github.com/marisadotdev/ZapierLoomlyBluesky).


## Setup Instructions

1. Create a new Zapier Zap.
2. Choose Loomly as the trigger app.
3. Choose "New Post" as the trigger event.
4. Connect your Loomly account.
5. Create a new Zapier Code action.
6. Copy and paste the code from `step.js` into the Code action.
7. Fill in the following inputs:
    * `username`: Your Bluesky username.
    * `password`: Your Bluesky App Password (not the main account password, set up a separate App Password in bluesky settings).
    * `post_text`: Connect to the "Post Text" field from the Loomly trigger.
    * `post_image_url`: Connect to the "Post Image URL" field from the Loomly trigger.
    * `post_image_mime_type`: Connect to the "Post Image MIME Type" field from the Loomly trigger.
8. Save and publish your Zap.

