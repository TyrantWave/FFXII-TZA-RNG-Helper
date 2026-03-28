import { ChangeDetectionStrategy, Component, effect, input, model, output, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule } from '@angular/forms';
import { DEFAULT_SEED, type SearchStatus } from '../../services/wasm.service';

const VALUE_COUNT = 5;

@Component({
  selector: 'tza-controls-panel',
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressBarModule, FormsModule],
  templateUrl: './controls-panel.html',
  styleUrl: './controls-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlsPanel {
  readonly searchStatus = input<SearchStatus>('idle');
  readonly elapsedSeconds = input(0);
  readonly position = input(0);
  readonly browseSeed = model(DEFAULT_SEED);
  readonly initialValues = input<number[]>([]);

  readonly findSeed = output<{ values: number[] }>();
  readonly findPosition = output<{ values: number[] }>();

  readonly observedValues = signal<(number | null)[]>(Array(VALUE_COUNT).fill(null));
  readonly indices = Array.from({ length: VALUE_COUNT }, (_, i) => i);

  constructor() {
    effect(() => {
      const init = this.initialValues();
      if (!init.length) return;
      const padded: (number | null)[] = Array(VALUE_COUNT).fill(null);
      init.forEach((v, i) => {
        if (i < VALUE_COUNT) padded[i] = v;
      });
      this.observedValues.set(padded);
    });
  }

  setValue(index: number, raw: string): void {
    const n = raw === '' ? null : parseInt(raw, 10);
    const updated = [...this.observedValues()];
    updated[index] = isNaN(n as number) ? null : n;
    this.observedValues.set(updated);
  }

  onFindSeed(): void {
    const values = this.observedValues().filter((v): v is number => v !== null);
    this.findSeed.emit({ values });
  }

  onFindPosition(): void {
    const values = this.observedValues().filter((v): v is number => v !== null);
    this.findPosition.emit({ values });
  }
}
