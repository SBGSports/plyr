import controls from '../../controls';
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

  addMarker(id, time) {
    const { timeline } = this.player.editor.elements.container;
    const markerTime = time || this.player.currentTime;
    const percentage = clamp((100 / this.player.duration) * parseFloat(markerTime), 0, 100);

    if (!timeline) {
      return;
    }

    const marker = createElement(
      'div',
      extend({
        id,
        class: this.player.config.classNames.markers.marker,
        'aria-valuemin': 0,
        'aria-valuemax': this.player.duration,
        'aria-valuenow': markerTime,
        'aria-valuetext': formatTime(markerTime),
        'aria-label': i18n.get('marker', this.player.config),
      }),
    );

    this.elements.markers.push(marker);
    timeline.appendChild(marker);

    // Set the markers default position to be at the current seek point
    marker.style.left = `${percentage}%`;
    this.addMarkerListeners(marker);

    // Add label to marker
    const label = createElement(
      'div',
      {
        class: this.player.config.classNames.markers.label,
      },
      id.replace(/_/g, ' '),
    );

    marker.appendChild(label);

    // Marker added event
    triggerEvent.call(this.player, this.player.media, 'markeradded', false, { id, time: markerTime });
  }

  removeMarker(id) {
    this.elements.markers.forEach(marker => {
      if (marker.id === id) {
        marker.remove();
      }
    });
  }

  removeMarkers() {
    this.elements.markers.forEach(marker => {
      marker.remove();
    });
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
      triggerEvent.call(this.player, this.player.media, 'markerchange', false, {
        id: marker.id,
        time: parseFloat(value),
      });
      this.editing = null;

      if (this.player.previewThumbnails) {
        this.player.previewThumbnails.endScrubbing(event);
      }
    } else if (type === 'mousedown' || type === 'touchstart') {
      this.editing = target;
      if (this.player.previewThumbnails) {
        this.player.previewThumbnails.startScrubbing(event);
      }
    }
  }

  setMarkerPosition(event) {
    if (is.nullOrUndefined(this.editing)) return;

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

    // Show the seek thumbnail
    if (this.player.previewThumbnails) {
      const seekTime = this.player.media.duration * (percentage / 100);
      this.player.previewThumbnails.showImageAtCurrentTime(seekTime);
    }
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
