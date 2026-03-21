import { Component, input } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import type { ValueLens } from '../../services/wasm.service';

@Component({
  selector: 'app-values-table',
  imports: [ScrollingModule],
  templateUrl: './values-table.html',
  styleUrl: './values-table.scss',
})
export class ValuesTable {
  readonly values = input<ValueLens[]>([]);
}
