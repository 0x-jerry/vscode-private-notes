# VSCode Writing

[English Version](./README.en.md)

一个专注隐私的插件，利用 `vscode` [虚拟工作区][virtual-workspace]，自动加解密当前工作区的文件。

## 使用方式

打开一个文件夹，使用命令 `Encrypt: Setup Workspace`，把当前工作去转换成加密工作区。

然后，使用命令 `Encrypt: Set or change password` 设置密码。

### 修改密码

使用命令 `Encrypt: Set or change password` 设置或者修改密码。

### 清除密码

使用命令 `Encrypt: Decrypt all files` 解密并清除密码。

## 配置

在项目根目录中创建 `/.encrypt.json` 文件，插件会自动读取配置。

具体配置项，请参考 [UserConfiguration](./src/configuration.ts) 类型。

示例：

不自动加密 `jpg/png` 图片

```json
{
  "exclude": ["**/*.jpg", "**/*.png"]
}
```

## 限制

部分插件无法使用。

## 实现方式

用 `vscode` 的虚拟工作区（FileSystemProvider），代理所有的文件 **读取/写入** 操作，
在读取的时候，用 `aes-256-gcm` 解密，在写入的时候，用 `aes-256-gcm` 加密。

[virtual-workspace]: https://code.visualstudio.com/api/extension-guides/virtual-workspaces
