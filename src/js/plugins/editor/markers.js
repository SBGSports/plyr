import { createElement, toggleHidden } from '../../utils/elements';
import { triggerEvent } from '../../utils/events';
import i18n from '../../utils/i18n';
import is from '../../utils/is';
import { clamp } from '../../utils/numbers';
import { extend } from '../../utils/objects';
import { formatTime } from '../../utils/time';

class Markers {
  constructor(player) {
    // Keep reference to parent
    this.player = player;
    this.config = player.config.markers;
    this.editing = null;
    this.elements = {
      markers: [],
    };

    this.load();
  }

  // Determine if Markers is enabled
  get enabled() {
    const { config, player } = this;
    return config.enabled && player.editor.enabled && player.isHTML5 && player.isVideo;
  }

  // Get active state
  get active() {
    if (!this.enabled) {
      return false;
    }

    return this.elements.markers.length > 0;
  }

  load() {
    // Update the UI
    this.update();
  }

  addMarker() {
    const { timeline } = this.player.editor.elements.container;
    const seekTime = this.player.elements.inputs.seek.value;

    const marker = createElement(
      'span',
      extend({
        class: this.player.config.classNames.markers.marker,
        'aria-valuemin': 0,
        'aria-valuemax': this.player.duration,
        'aria-valuenow': seekTime,
        'aria-valuetext': formatTime(seekTime),
        'aria-label': i18n.get('marker', this.player.config),
      }),
    );

    this.elements.markers.push(marker);
    timeline.appendChild(marker);

    // Set the markers default position to be at the current seek point
    marker.style.left = `${seekTime}%`;
    this.addMarkerListeners(marker);
  }

  addMarkerListeners(marker) {
    // Listen for marker selection
    this.player.listeners.bind(marker, 'mousedown touchstart', event => {
      this.setEditing(event);
    });

    // Listen for marker deselection
    this.player.listeners.bind(document.body, 'mouseup touchend', event => {
      if (!is.nullOrUndefined(this.editing)) {
        this.setEditing(event);
      }
    });

    // Move marker if selected
    this.player.listeners.bind(document.body, 'mousemove touchmove', event => {
      if (!is.nullOrUndefined(this.editing)) {
        this.setMarkerPosition(event);
      }
    });
  }

  setEditing(event) {
    const { type, target } = event;
    const marker = this.editing;

    if (type === 'mouseup' || type === 'touchend') {
      const value = marker.getAttribute('aria-valuenow');
      triggerEvent.call(this.player, this.player.media, 'markerchange', false, value);
      this.editing = null;
    } else if (type === 'mousedown' || type === 'touchstart') {
      this.editing = target;
    }
  }

  setMarkerPosition(event) {
    if (is.empty(this.editing)) return;

    // Calculate hover position
    const { timeline } = this.player.editor.elements.container;
    const clientRect = timeline.getBoundingClientRect();
    const xPos = event.type === 'touchmove' ? event.touches[0].pageX : event.pageX;
    const percentage = clamp((100 / clientRect.width) * (xPos - clientRect.left), 0, 100);
    const time = this.player.media.duration * (percentage / 100);
    // Selected marker element
    const marker = this.editing;

    // Update the position of the marker
    marker.style.left = `${percentage}%`;
    marker.setAttribute('aria-valuenow', time);
    marker.setAttribute('aria-valuetext', formatTime(time));
  }

  toggleMarkers(show = true) {
    this.elements.markers.forEach(marker => {
      toggleHidden(marker, show);
    });
  }

  // Update UI
  update() {
    if (this.enabled) {
      this.player.debug.log(`Video Markers enabled`);
    } else {
      this.player.debug.log('Video markers is not supported');
    }
  }

  destroy() {
    // Remove the elements with listeners on
    if (this.elements.markers && !is.empty(this.elements.markers)) {
      // This should be cleaned up the by the editor
      this.elements.markers = {};
    }
  }
}

export default Markers;
