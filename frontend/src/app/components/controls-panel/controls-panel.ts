import { ChangeDetectionStrategy, Component, input, linkedSignal, model, output } from '@angular/core';
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

  readonly observedValues = linkedSignal<(number | null)[]>(() => {
    const init = this.initialValues();
    if (!init.length) return Array(VALUE_COUNT).fill(null);
    const padded: (number | null)[] = Array(VALUE_COUNT).fill(null);
    init.slice(0, VALUE_COUNT).forEach((v, i) => {
      padded[i] = v;
    });
    return padded;
  });
  readonly indices = Array.from({ length: VALUE_COUNT }, (_, i) => i);

  onSeedInput(event: Event): void {
    this.browseSeed.set(+(event.target as HTMLInputElement).value);
  }

  setValue(index: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
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
