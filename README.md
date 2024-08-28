# VS Code Extension for goose

This runs <a href="https://github.com/square/goose">goose</a> in your VS Code instance every time you open it, and lets you interact with goose either directly, or you can highlight sections of code, ask questions about it, or even ask it to change the code or do work with it.

> [!IMPORTANT]  
> This requires that you have <a href="https://github.com/square/goose">goose</a> installed and running for this to work. 
> **This is a work in progress as we explore what modalities we want from goose an an IDE. Use with caution.**

## Table of Contents

- [In Action](#in-action)
- [Running from Source](#running-from-source)
- [Installation into VS Code from Source](#installation-into-vs-code-from-source)
  - [Packaging the Extension](#packaging-the-extension)
  - [Installing the Extension](#installing-the-extension)
  - [Uninstalling the Extension](#uninstalling-the-extension)

## In Action

![Screenshot 2024-08-16 at 6 04 02 PM](https://github.com/user-attachments/assets/ab25b87b-fb8e-427e-80cd-52569e0c295a)

![Screenshot 2024-08-16 at 6 03 09 PM](https://github.com/user-attachments/assets/f61408bb-e54b-4520-848a-9a1f0f599baa)
![Screenshot 2024-08-16 at 6 03 31 PM](https://github.com/user-attachments/assets/c057df95-eb5c-4ec1-84a1-fd694c47848f)

Can ask it to enhance code, can run commands, take action, test and more:

![Screenshot 2024-08-16 at 6 04 54 PM](https://github.com/user-attachments/assets/1ad84665-186f-4473-8f92-d994ba5fc663)

## Running from Source

Open this repo via `code .` and then press F5 to run a new workspace with this in it. 

## Installation into VS Code from Source

### Packaging the Extension

To package the extension, run the following command:

```sh
npm install 
npm run package
```

This will create a `.vsix` file in the root directory of the project.

### Installing the Extension

To install the packaged extension, use the following command:

```sh
code --install-extension goose-vscode-1.0.0.vsix
```

### Uninstalling the Extension

To uninstall the extension, use the following command:

```sh
code --uninstall-extension block.goose-vscode
```
