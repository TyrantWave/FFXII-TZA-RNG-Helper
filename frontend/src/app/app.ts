import { Component, effect, inject } from '@angular/core';
import { WasmService } from './services/wasm.service';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly wasm = inject(WasmService);

  constructor() {
    effect(() => {
      if (this.wasm.isReady()) {
        console.log('WASM ready');
        this.wasm.createHelper(4537, { level: 70, magic: 99, spell: 'Cure', serenity: true }, 10);
        console.log('seed:', this.wasm.seed());
        console.log('values:', this.wasm.values());
      }
    });
  }
}
