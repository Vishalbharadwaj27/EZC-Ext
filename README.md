This is the README for your extension "ez-coder". An all-in-one assistant with an AI agent, code visualizer, and study roadmaps.

## Setup Requirements

This extension requires a personal API key from [Hugging Face](https://huggingface.co/) to function. You have two options to configure your API key:

### Option 1: VS Code Settings (Recommended)

1.  **Get your API Key**: Go to your [Hugging Face account settings](https://huggingface.co/settings/tokens) and create a new API token with **write** permissions.
2.  **Set the API Key in VS Code**:
      * Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the Command Palette.
      * Type "**Preferences: Open User Settings (JSON)**" and select it.
      * Add the following line to your `settings.json` file, replacing `"YOUR_API_KEY_HERE"` with your actual key:
        ```json
        "ez-coder.huggingFaceApiKey": "YOUR_API_KEY_HERE"
        ```
3.  **Save** the settings file and reload VS Code.

### Option 2: Environment Variable

1.  **Create a .env file**: In the root directory of your project, create a file named `.env`.
2.  **Add your API key**: Add the following line to the `.env` file, replacing `your_api_key_here` with your actual key:
    ```
    HUGGINGFACE_API_KEY=your_api_key_here
    ```
3.  **Important**: The `.env` file is automatically ignored by git to keep your API key secure.

### Verifying Your Setup

After configuring your API key, you can verify it by:

  * Opening the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
  * Running the command "**EZ-Coder: Verify Hugging Face API Key**".

### Security Note

  * Never commit your API key to version control.
  * The `.env` file is included in `.gitignore` to prevent accidental commits.
  * When sharing your code, others will need to set up their own API keys.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension\! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

This extension contributes the following settings:

  * `ez-coder.huggingFaceApiKey`: Your personal Hugging Face API Key.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 0.0.1

  - Initial release of EZ-Coder.

-----

## Working with Markdown

You can author your README using Visual Studio Code.  Here are some useful editor keyboard shortcuts:

  * Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux)
  * Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux)
  * Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets

## For more information

  * [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
  * [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy\!**