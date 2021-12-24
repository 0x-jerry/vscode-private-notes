import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';

export class Status extends Dispose {
  bar: StatusBarItem;

  constructor() {
    super();

    this.bar = window.createStatusBarItem(StatusBarAlignment.Right, 10000);
    this.bar.show();

    this.addDisposable(this.bar);

    this.watch();
  }

  watch() {
    window.onDidChangeActiveTextEditor((e) => {
      if (!e) return;

      const excluded = globalCtx.configuration.isExclude(e.document.uri);

      if (excluded) {
        this.bar.text = '$(unlock)';
        this.bar.tooltip = 'This file is not encrypt.';
      } else {
        this.bar.text = '$(lock)';
        this.bar.tooltip = 'This file is encrypt.';
      }
    });
  }
}
