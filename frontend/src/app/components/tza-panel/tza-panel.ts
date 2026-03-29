import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'tza-panel',
  templateUrl: './tza-panel.html',
  styleUrl: './tza-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TzaPanel {
  readonly title = input.required<string>();
  readonly showBorder = input(true);
}
