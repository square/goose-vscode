# VS Code Extension for goose ai

Goose is a developers agent that runs on your machine. 

This runs <a href="https://github.com/square/goose">goose</a> in your VS Code instance every time you open it, and lets you interact with goose either directly, or you can highlight sections of code, ask questions about it, or even ask it to change the code or do work with it.

> [!WARNING]
> This is an experimental and work in progress extension, update it frequently.
> This requires that you have <a href="https://github.com/square/goose">goose ai</a> installed for this to work. 
> **This is a work in progress as we explore what modalities we want from goose an an IDE. Use with caution.**
> [issue tracker](https://github.com/square/goose-vscode/issues)

## Installing 

You can install this extension from the extensions in VS Code directly from the marketplace: 

1. Ensure you have [goose ai](https://github.com/square/goose) installed as a prequisite
2. Install from the [Visual Studio Marketplace - goose-vscode](https://marketplace.visualstudio.com/items?itemName=michaelneale.goose-vscode)
3. Restart VS Code if necessary, goose will then open up in the right hand panel. 

## Using goose in VS Code

To use goose, you can ask it questions about your codebase in the main goose panel using goose chat: 

Open with command+shift+P and then open the goose terminal if not already there.

![image](https://github.com/user-attachments/assets/0e3f7ed5-9c2c-474b-aa8c-98ceb7dc9229)

You can then ask it about your code or to take some actions. 

You can also "ask goose" which can work in context of what you have highlighted: 

![image](https://github.com/user-attachments/assets/8c6e3309-3458-4332-88f8-b909219f358b)


Anywhere in your code you can "ask goose" to do something with the "code lens", or press `.` to ask goose to complete what you have started: 

![image](https://github.com/user-attachments/assets/0bf6fbc2-e8b6-42ff-9567-be168b20faa1)

You can ask goose to make edits, test, change something, deploy something, anything about your project. Goose will then do its best
to go off and fulfill the task. Works best when you tell it how to test your code/get some feedback, so it can do that for you. 
Give it some time, but you can interrupt it when you need to.

> [!TIP]
> Put a `.goosehints` in the root of your project with some tips on how to run you project so goose knows. 

There are "quick fixes" where you can ask goose to fix the problem: 

![image](https://github.com/user-attachments/assets/25c87890-2f3c-4c04-a8a0-3e9e073c7b07)


Some more examples of goose in action:

![action1](https://github.com/user-attachments/assets/7cecc165-72c3-4936-977e-f7b9cf2c3906)

![action2](https://github.com/user-attachments/assets/2425f54d-c88b-4ef0-b00e-1ceac9a8dcd5)
![action3](https://github.com/user-attachments/assets/e35296d8-aaf7-43e1-915c-6fb86ed05cb9)
![action4](https://github.com/user-attachments/assets/c6f00750-0f28-4683-84a1-765740c72fba)

Ask it to enhance code, can run commands as you on command line, take action, run tests and more.


## Developing the Extension

NOTE: You don't usually need to install this from source as it is in the extensions marketplace.
This is for if you want to enhance the extension or fix bugs.

### Running from Source

> [!TIP]
> You don't usually need to run this from source unless you are working on this extension.

Open this repo via `code .`, open `src/extension.ts` and then press F5 to run a new workspace with this in it. 

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
code --install-extension your .vsix file here.
```

### Uninstalling the Extension

To uninstall the extension, use the following command:

```sh
code --uninstall-extension block.goose-vscode
```
