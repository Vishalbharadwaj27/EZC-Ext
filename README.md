# ez-coder README

This is the README for your extension "ez-coder". After writing up a brief description, we recommend including the following sections.

## Developer Setup

To run this extension locally for development, you need to provide your own OpenRouter API key.

1.  **Locate the example file**: In the root of the project, you will find a file named `secrets.example.js`.
2.  **Create your secrets file**: Create a copy of this file and rename it to `secrets.js`.
3.  **Add your API key**: Open the new `secrets.js` file and replace the placeholder string `"PASTE_YOUR_OPENROUTER_API_KEY_HERE"` with your actual OpenRouter API key.
4.  **Done!** The `secrets.js` file is already listed in `.gitignore`, so your key will not be committed.

## Setup Requirements

This extension requires a personal API key from [OpenRouter.ai](https://openrouter.ai/) to function. You have two options to configure your API key:

### Option 1: VS Code Settings (Recommended)
1. **Get your API Key**: Go to your OpenRouter account settings and create a new API key.
2. **Set the API Key in VS Code**:
    * Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the Command Palette
    * Type "Preferences: Open User Settings (JSON)" and select it
    * Add the following line to your `settings.json` file, replacing `"YOUR_API_KEY_HERE"` with your actual key:
        ```json
        "ez-coder.openRouterApiKey": "YOUR_API_KEY_HERE"
        ```
3. **Save** the settings file and reload VS Code

### Option 2: Environment Variable
1. **Create a .env file**: In the root directory of your project, create a file named `.env`
2. **Add your API key**: Add the following line to the `.env` file:
    ```
    OPENROUTER_API_KEY=your_api_key_here
    ```
3. **Important**: The `.env` file is automatically ignored by git to keep your API key secure

### Verifying Your Setup
1. After configuring your API key, you can verify it by:
    * Opening the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
    * Running the command "EZ-Coder: Verify OpenRouter API Key"

### Security Note
* Never commit your API key to version control
* The `.env` file is included in `.gitignore` to prevent accidental commits
* When sharing your code, others will need to set up their own API keys

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\](images/feature-x.png)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Working with Markdown

You can author your README using Visual Studio Code.  Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux)
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux)
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**