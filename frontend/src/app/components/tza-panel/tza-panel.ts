import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'tza-panel',
  templateUrl: './tza-panel.html',
  styleUrl: './tza-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TzaPanel {
  readonly title = input('');
  readonly showBorder = input(true);
  /** Fill the host height — enables flex-column layout so slotted content can scroll */
  readonly fillHeight = input(false);
  /** Remove panel-header padding when projecting custom header content via [panel-header] */
  readonly customHeader = input(false);
}
