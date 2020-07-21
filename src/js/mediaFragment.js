import { clamp } from './utils/numbers';
import { parseUrlHash } from './utils/urls';

class MediaFragment {
  constructor(player) {
    const { config } = player;

    this.player = player;
    this.source = player.currentSrc;
    this.config = config.mediaFragment;
    this.active = false;
    this.startTime = 0;
    this.duration = player.media.duration;

    // Wait until player has duration before setting media fragment
    this.player.on('loadedmetadata', () => {
      if (this.player.duration && !this.active) this.load();
    });
  }

  get enabled() {
    return this.config.enabled;
  }

  load() {
    const mediaFragment = parseUrlHash(this.player.source).match('t=[0-9]+(.([0-9]+))?,[0-9]+(.([0-9]+))?');

    if (!mediaFragment) return;

    const { config } = this.player;

    if (config.duration) {
      this.player.debug.warn('Cannot have custom duration in conjunction with media fragments');
      return;
    }

    const resourceTimes = mediaFragment[0].replace('t=', '').split(',');
    const startTime = parseFloat(resourceTimes[0]);
    const endTime = parseFloat(resourceTimes[1]) - parseFloat(resourceTimes[0]);

    this.active = true;
    this.startTime = clamp(startTime, 0, this.player.media.duration);
    this.duration = clamp(endTime, 0, this.player.media.duration);
  }

  getMediaTime(input) {
    if (!this.enabled || !this.active) return input;
    return input + this.startTime;
  }

  destroy() {
    if (!this.enabled) return;

    const { config } = this.player;

    this.active = false;

    // Reset start and duration back to default values
    config.startTime = 0;
    this.player.once('loadedmetadata', () => {
      config.duration = this.media.duration;
    });
  }
}

export default MediaFragment;
