import { Disposable } from 'vscode';

export class Dispose implements Disposable {
  disposable: Disposable[] = [];

  dispose() {
    this.disposable.forEach((n) => n.dispose());
  }
}
