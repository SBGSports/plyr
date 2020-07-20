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

    this.load();
  }

  get enabled() {
    return this.config.enabled;
  }

  load() {
    const mediaFragment = parseUrlHash(this.player.source).match('t=[0-9]+,[0-9]+');

    if (!mediaFragment) return;

    const { config } = this.player;

    if (config.duration) {
      this.player.debug.warn('Cannot have custom duration in conjunction with media fragments');
      return;
    }

    const resourceTimes = mediaFragment[0].match(/[0-9]+/g);
    const startTime = parseInt(resourceTimes[0], 10);
    const endTime = parseInt(resourceTimes[1], 10) - parseInt(resourceTimes[0], 10);

    this.active = true;
    this.startTime = clamp(startTime, 0, this.player.media.duration);
    this.duration = clamp(endTime, 0, this.player.media.duration);
  }

  destroy() {
    if (!this.enabled) return;

    const { config } = this.player;

    this.active = false;

    // Reset start and duration back to default values
    config.startTime = 0;
    this.once('loadedmetadata', () => {
      config.duration = this.media.duration;
    });
  }
}

export default MediaFragment;
