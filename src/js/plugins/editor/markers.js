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
    this.loaded = false;
    this.preLoadedMarkers = [];
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

  get lowerBound() {
    const { trim, duration } = this.player;

    return trim.active && this.config.lockToTrimRegion ? (trim.startTime / duration) * 100 : 0;
  }

  get upperBound() {
    const { trim, duration } = this.player;

    return trim.active && this.config.lockToTrimRegion ? (trim.endTime / duration) * 100 : 100;
  }

  load() {
    // Marker listeners
    this.listeners();

    // Update the UI
    this.update();
  }

  addMarker(id, name, time) {
    const { timeline } = this.player.editor.elements.container;
    const { mediaFragment } = this.player;
    const markerTime = time || this.player.currentTime;
    // For media fragments the start time can be different from the media's start time
    const mediaMarkerTime = mediaFragment.getMediaTime(markerTime);
    const percentage = clamp((100 / this.player.duration) * parseFloat(markerTime), 0, 100);

    if (!this.loaded || !is.element(timeline)) {
      this.preLoadedMarkers.push({ id, name, time });
      return;
    }

    const container = createElement(
      'div',
      extend({
        id,
        class: this.player.config.classNames.markers.container,
        'aria-valuemin': 0,
        'aria-valuemax': this.player.duration,
        'aria-valuenow': markerTime,
        'aria-valuetext': formatTime(markerTime),
        'aria-label': i18n.get('marker', this.player.config),
      }),
    );

    this.elements.markers.push(container);
    timeline.appendChild(container);

    // Set the markers default position to be at the current seek point
    container.style.left = `${percentage}%`;
    this.addMarkerListeners(container);

    const marker = createElement(
      'div',
      extend({
        id: `${id}Marker`,
        class: this.player.config.classNames.markers.marker,
      }),
    );

    container.appendChild(marker);

    // Add label to marker
    const label = createElement(
      'div',
      {
        id: `${id}Label`,
        class: this.player.config.classNames.markers.label,
      },
      name,
    );

    marker.appendChild(label);

    // Marker added event
    triggerEvent.call(this.player, this.player.media, 'markeradded', false, { id, time: mediaMarkerTime });
  }

  moveMarker(id) {
    const { currentTime, mediaFragment } = this.player;
    const marker = this.elements.markers.find(x => x.id === id);
    // Calculate marker position in percent
    const percentage = clamp((currentTime / this.player.media.duration) * 100, this.lowerBound, this.upperBound);

    if (!marker) return;

    // Update the position of the marker
    marker.style.left = `${percentage}%`;
    marker.setAttribute('aria-valuenow', currentTime);
    marker.setAttribute('aria-valuetext', formatTime(currentTime));

    // For media fragments the start time can be different from the media's start time
    const mediaCurrentTime = mediaFragment.getMediaTime(parseFloat(currentTime));

    // Trigger marker change event
    triggerEvent.call(this.player, this.player.media, 'markerchange', false, {
      id: marker.id,
      time: mediaCurrentTime,
    });
  }

  goToMarker(id) {
    const marker = this.elements.markers.find(x => x.id === id);

    if (!marker) return;

    // Go to marker on timeline
    this.player.currentTime = Number(marker.getAttribute('aria-valuenow'));
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
    const { mediaFragment } = this.player;
    const { type, currentTarget } = event;
    const marker = this.editing;

    if (type === 'mouseup' || type === 'touchend') {
      const value = marker.getAttribute('aria-valuenow');
      // For media fragments the start time can be different from the media's start time
      const mediaValue = mediaFragment.getMediaTime(parseFloat(value));

      triggerEvent.call(this.player, this.player.media, 'markerchange', false, {
        id: marker.id,
        time: mediaValue,
      });

      this.editing = null;
    } else if (type === 'mousedown' || type === 'touchstart') {
      this.editing = currentTarget;
      if (this.previewThumbnailsReady) {
        this.player.previewThumbnails.startScrubbing(event);
      }
    }
  }

  setMarkerPosition(event) {
    if (is.nullOrUndefined(this.editing)) return;

    // Calculate hover position
    const { timeline } = this.player.editor.elements.container;
    const { duration } = this.player;
    const clientRect = timeline.getBoundingClientRect();
    const xPos = event.type === 'touchmove' ? event.touches[0].pageX : event.pageX;
    // Calculate the position of the marker
    const percentage = clamp((100 / clientRect.width) * (xPos - clientRect.left), this.lowerBound, this.upperBound);
    const time = duration * (percentage / 100);
    // Selected marker element
    const marker = this.editing;

    // Update the position of the marker
    marker.style.left = `${percentage}%`;
    marker.setAttribute('aria-valuenow', time);
    marker.setAttribute('aria-valuetext', formatTime(time));
  }

  listeners() {
    this.player.on('loadeddata loadedmetadata editorloaded', () => {
      const { duration, editor } = this.player;
      // If markers have been added before the player has a duration add this markers
      if (!duration || (editor.active && !is.element(editor.elements.container.timeline))) {
        return;
      }

      this.loaded = true;

      if (this.preLoadedMarkers.length) {
        this.preLoadedMarkers.forEach(marker => this.addMarker(marker.id, marker.name, marker.time));
        this.preLoadedMarkers = [];
      }
    });

    this.player.on('trimchanging trimchange', () => {
      this.elements.markers.forEach(marker => {
        // eslint-disable-next-line no-param-reassign
        marker.style.left = `${clamp(parseFloat(marker.style.left), this.lowerBound, this.upperBound)}%`;
      });
    });
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
