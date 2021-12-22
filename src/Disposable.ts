import { Disposable } from 'vscode';

export class Dispose implements Disposable {
  disposable: Disposable[] = [];

  addDisposable(d: Disposable) {
    this.disposable.push(d);
  }

  dispose() {
    this.disposable.forEach((n) => n.dispose());
  }
}
