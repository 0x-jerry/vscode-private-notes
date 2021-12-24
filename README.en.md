# VSCode Writing

[中文版本](./README.md)

A extension that focus on privacy, use `vscode` [virtual workspace][virtual-workspace] to auto encrypt and decrypt current workspace files.

## Usage

Open a folder, then use `Encrypt: Setup Workspace` command to transform current workspace into encrypt workspace.

Then use `Encrypt: Set or change password` to set a password.

## Change password

Use `Encrypt: Set or change password` to set or change the password.

## Clear encryption

Use `Encrypt: Decrypt all files` to clear password and decrypt all files.

## Configuration

Configuration file location: `./encrypt.json`.

Please refer [UserConfiguration](./src/configuration.ts) to see all options.

example:

Do not auto encrypt and decrypt `jpg/png` file.

```json
{
  "exclude": ["**/*.jpg", "**/*.png"]
}
```

## Limitation

You can only use a part of extensions because of [virtual workspace limitation][virtual-workspace-limitation].

# Core concept

use `vscode` `FileSystemProvider` API, delegate all **read/write** action,
use `aes-256-gcm` to decrypt when read file and encrypt when write file.

[virtual-workspace]: https://code.visualstudio.com/api/extension-guides/virtual-workspaces
[virtual-workspace-limitation]: https://code.visualstudio.com/api/extension-guides/virtual-workspaces#review-that-the-extension-code-is-ready-for-virtual-resources
