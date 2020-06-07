// ==========================================================================
// Plyr Trim control
// ==========================================================================

import { createElement, toggleClass, toggleHidden } from '../../utils/elements';
import { on, triggerEvent } from '../../utils/events';
import i18n from '../../utils/i18n';
import is from '../../utils/is';
import { clamp } from '../../utils/numbers';
import { extend } from '../../utils/objects';
import { formatTime } from '../../utils/time';

class Trim {
  constructor(player) {
    // Keep reference to parent
    this.player = player;
    this.config = player.config.trim;
    this.loaded = false;
    this.trimming = false;
    this.editing = false;
    this.defaultTrimLength = 20; // Trim length in percent
    this.startTime = 0;
    this.endTime = 0;
    this.timeUpdateFunction = this.timeUpdate.bind(this);
    this.elements = {
      container: {},
    };

    this.load();
  }

  // Determine if trim is enabled
  get enabled() {
    const { config } = this;
    return config.enabled && this.player.isHTML5 && this.player.isVideo;
  }

  // Get active state
  get active() {
    if (!this.enabled) {
      return false;
    }

    return this.trimming;
  }

  // Get the current trim time
  get trimTime() {
    return { startTime: this.startTime, endTime: this.endTime };
  }

  load() {
    // Handle event (incase user presses escape etc)
    on.call(this.player, document, () => {
      this.onChange();
    });

    // Update the UI
    this.update();

    // Setup player listeners
    this.listeners();
  }

  // Store the trim start time in seconds
  setStartTime(percentage) {
    this.startTime = this.player.media.duration * (parseFloat(percentage) / 100);
  }

  // Store the trim end time in seconds
  setEndTime(percentage) {
    this.endTime = this.player.media.duration * (parseFloat(percentage) / 100);
  }

  // Show the trim toolbar on the timeline
  showTrimTool() {
    if (this.player.editor && !this.player.editor.active) {
      this.player.editor.enter();
    }
    if (is.empty(this.elements.container.bar)) {
      this.createTrimTool();
    }
    toggleHidden(this.elements.container, false);
  }

  // Hide the trim toolbar from the timeline
  hideTrimTool() {
    if (this.config.closeEditor) {
      this.player.editor.exit();
    }

    toggleHidden(this.elements.container, true);
  }

  // Add trim toolbar to the timeline
  createTrimTool() {
    const { container } = this.player.elements;
    if (is.element(container) && this.loaded) {
      this.createTrimContainer();
      this.createTrimBar();
      this.createTrimBarThumbs();
      this.createShadedRegions();
      this.createThumbTime();
    }
  }

  // Add trim container to the timeline
  createTrimContainer() {
    this.elements.container = createElement('div', {
      class: this.player.config.classNames.trim.container,
    });
    this.player.editor.elements.container.timeline.appendChild(this.elements.container);
  }

  // Add trim bar to the timeline
  createTrimBar() {
    // Set the trim bar from the current seek time percentage to x percent after and limit the end percentage to 100%
    const start = clamp((100 / this.player.duration) * parseFloat(this.player.currentTime), 0, 100);
    const end = Math.min(parseFloat(start) + this.defaultTrimLength, 100);

    // Store the start and end video percentages in seconds
    this.setStartTime(start);
    this.setEndTime(end);

    this.elements.container.bar = createElement('span', {
      class: this.player.config.classNames.trim.trimTool,
    });

    const { bar } = this.elements.container;

    bar.style.left = `${start.toString()}%`;
    bar.style.width = `${end - start.toString()}%`;
    this.elements.container.appendChild(bar);

    triggerEvent.call(this.player, this.player.media, 'trimchange', false, this.trimTime);
  }

  // Add trim length thumbs to the timeline
  createTrimBarThumbs() {
    const { bar } = this.elements.container;
    const { trim } = this.player.config.classNames;

    // Create the trim bar thumb elements
    bar.leftThumb = createElement(
      'span',
      extend({
        class: trim.leftThumb,
        role: 'slider',
        'aria-valuemin': 0,
        'aria-valuemax': this.player.duration,
        'aria-valuenow': this.startTime,
        'aria-valuetext': formatTime(this.startTime),
        'aria-label': i18n.get('trimStart', this.player.config),
      }),
    );

    // Create the trim bar thumb elements
    bar.rightThumb = createElement(
      'span',
      extend({
        class: trim.rightThumb,
        role: 'slider',
        'aria-valuemin': 0,
        'aria-valuemax': this.player.duration,
        'aria-valuenow': this.endTime,
        'aria-valuetext': formatTime(this.endTime),
        'aria-label': i18n.get('trimEnd', this.player.config),
      }),
    );

    // Add the thumbs to the bar
    bar.appendChild(bar.leftThumb);
    bar.appendChild(bar.rightThumb);

    // Add listens for trim thumb (handle) selection
    this.player.listeners.bind(bar.leftThumb, 'mousedown touchstart', event => {
      if (bar) {
        this.setEditing(event);
      }
    });

    // Listen for trim thumb (handle) selection
    this.player.listeners.bind(bar.rightThumb, 'mousedown touchstart', event => {
      if (bar) {
        this.setEditing(event);
      }
    });

    // Move trim handles if selected
    this.player.listeners.bind(document.body, 'mousemove touchmove', event => {
      if (this.editing) {
        this.setTrimLength(event);
      }
    });

    // Stop trimming when handle is no longer selected
    this.player.listeners.bind(document.body, 'mouseup touchend', event => {
      if (this.editing) this.setEditing(event);
    });
  }

  // Add shaded out regions to show that this area is not being trimmed
  createShadedRegions() {
    const { container } = this.elements;

    // Create two shaded regions on the timeline (before and after the trimming tool)
    container.shadedRegions = [];
    const shadedRegion = createElement('span', {
      class: this.player.config.classNames.trim.shadedRegion,
    });

    const shadedRegionClone = shadedRegion.cloneNode(true);

    // Store and append the shaded regions to the container
    container.shadedRegions.push(shadedRegion);
    container.shadedRegions.push(shadedRegionClone);
    container.insertBefore(shadedRegion, container.bar);
    container.insertBefore(shadedRegionClone, container.bar.nextSibling);

    this.setShadedRegions();
  }

  setShadedRegions() {
    const { shadedRegions } = this.elements.container;
    const { left, width } = this.elements.container.bar.style;

    // Retrieve the first and second shaded regions (should always be two regions)
    if (shadedRegions.length < 1) {
      return;
    }

    // Set the position of the shaded regions relative to the position of the trimming tool
    shadedRegions[0].style.width = left;
    shadedRegions[1].style.left = `${parseFloat(left) + parseFloat(width)}%`;
    shadedRegions[1].style.width = `${100 - (parseFloat(left) + parseFloat(width))}%`;
  }

  createThumbTime() {
    const { leftThumb, rightThumb } = this.elements.container.bar;

    // Create HTML element, parent+span: time text (e.g., 01:32:00)
    leftThumb.timeContainer = createElement('div', {
      class: this.player.config.classNames.trim.timeContainer,
    });

    rightThumb.timeContainer = createElement('div', {
      class: this.player.config.classNames.trim.timeContainer,
    });

    // Append the time element to the container
    leftThumb.timeContainer.time = createElement('span', {}, formatTime(this.startTime));
    leftThumb.timeContainer.appendChild(leftThumb.timeContainer.time);
    rightThumb.timeContainer.time = createElement('span', {}, formatTime(this.endTime));
    rightThumb.timeContainer.appendChild(rightThumb.timeContainer.time);

    // Append the time container to the bar
    leftThumb.appendChild(leftThumb.timeContainer);
    rightThumb.appendChild(rightThumb.timeContainer);
  }

  setEditing(event) {
    const { bar } = this.elements.container;
    const { leftThumb, rightThumb } = this.player.config.classNames.trim;
    const { type, target } = event;

    if ((type === 'mouseup' || type === 'touchend') && this.editing === leftThumb) {
      this.editing = null;
      this.toggleTimeContainer(bar.leftThumb, false);
      if (this.player.previewThumbnails) {
        this.player.previewThumbnails.endScrubbing(event);
      }
      triggerEvent.call(this.player, this.player.media, 'trimchange', false, this.trimTime);
    } else if ((type === 'mouseup' || type === 'touchend') && this.editing === rightThumb) {
      this.editing = null;
      this.toggleTimeContainer(bar.rightThumb, false);
      if (this.player.previewThumbnails) {
        this.player.previewThumbnails.endScrubbing(event);
      }
      triggerEvent.call(this.player, this.player.media, 'trimchange', false, this.trimTime);
    } else if ((type === 'mousedown' || type === 'touchstart') && target.classList.contains(leftThumb)) {
      this.editing = leftThumb;
      this.toggleTimeContainer(bar.leftThumb, true);
      if (this.player.previewThumbnails) {
        this.player.previewThumbnails.startScrubbing(event);
      }
    } else if ((type === 'mousedown' || type === 'touchstart') && target.classList.contains(rightThumb)) {
      this.editing = rightThumb;
      this.toggleTimeContainer(bar.rightThumb, true);
      if (this.player.previewThumbnails) {
        this.player.previewThumbnails.startScrubbing(event);
      }
    }
  }

  setTrimLength(event) {
    if (!this.editing) return;

    // Calculate hover position
    const { timeline } = this.player.editor.elements.container;
    const clientRect = timeline.getBoundingClientRect();
    const xPos = event.type === 'touchmove' ? event.touches[0].pageX : event.pageX;
    const percentage = clamp((100 / clientRect.width) * (xPos - clientRect.left), 0, 100);
    // Get the current position of the trim tool bar
    const { leftThumb, rightThumb } = this.player.config.classNames.trim;
    const { bar } = this.elements.container;

    // Update the position of the trim range tool
    if (this.editing === leftThumb) {
      // Set the width to be in the position previously
      bar.style.width = `${parseFloat(bar.style.width) - (percentage - parseFloat(bar.style.left))}%`;
      // Increase the left thumb
      bar.style.left = `${percentage}%`;
      // Store and convert the start percentage to time
      this.setStartTime(percentage);
      // Prevent the end time being before the start time
      if (this.startTime > this.endTime) {
        this.setEndTime(percentage);
      }
      // Set the timestamp of the current trim handle position
      if (bar.leftThumb.timeContainer) {
        bar.leftThumb.timeContainer.time.innerText = formatTime(this.startTime);
      }
      // Update the aria-value and text
      bar.leftThumb.setAttribute('aria-valuenow', this.startTime);
      bar.leftThumb.setAttribute('aria-valuetext', formatTime(this.startTime));
    } else if (this.editing === rightThumb) {
      // Prevent the end time to be before the start time
      if (percentage <= parseFloat(bar.style.left)) {
        return;
      }
      // Update the width of trim bar (right thumb)
      bar.style.width = `${percentage - parseFloat(bar.style.left)}%`;
      // Store and convert the start percentage to time
      this.setEndTime(percentage);
      // Set the timestamp of the current trim handle position
      if (bar.rightThumb.timeContainer) {
        bar.rightThumb.timeContainer.time.innerText = formatTime(this.endTime);
      }
      // Update the aria-value and text
      bar.rightThumb.setAttribute('aria-valuenow', this.endTime);
      bar.rightThumb.setAttribute('aria-valuetext', formatTime(this.endTime));
    }

    // Update the shaded out regions on the timeline
    this.setShadedRegions();

    // Show the seek thumbnail
    if (this.player.previewThumbnails) {
      const seekTime = this.player.media.duration * (percentage / 100);
      this.player.previewThumbnails.showImageAtCurrentTime(seekTime);
    }
  }

  toggleTimeContainer(element, toggle = false) {
    if (!element.timeContainer) {
      return;
    }

    const className = this.player.config.classNames.trim.timeContainerShown;
    element.timeContainer.classList.toggle(className, toggle);
  }

  // Set the seektime to the start of the trim timeline, if the seektime is outside of the region.
  timeUpdate() {
    if (!this.active || !this.trimming || !this.player.playing || this.editing) {
      return;
    }

    const { currentTime } = this.player;
    if (currentTime < this.startTime || currentTime >= this.endTime) {
      this.player.currentTime = this.startTime;

      if (currentTime >= this.endTime) {
        this.player.pause();
      }
    }
  }

  listeners() {
    /* Prevent the trim tool from being added until the player is in a playable state
           If the user has pressed the trim tool before this event has fired, show the tool
        */
    this.player.once('canplay', () => {
      this.loaded = true;
      if (this.trimming) {
        this.createTrimTool();
      }
    });

    /* Listen for time changes so we can reset the seek point to within the clip.
           Additionally, use the reference to the binding so we can remove and create a new instance of this listener
           when we change source
        */
    this.player.on('timeupdate', this.timeUpdateFunction);
  }

  // On toggle of trim control, trigger event
  onChange() {
    if (!this.enabled) {
      return;
    }

    // Update toggle button
    const button = this.player.elements.buttons.trim;
    if (is.element(button)) {
      button.pressed = this.active;
    }

    // Trigger an event
    triggerEvent.call(this.player, this.player.media, this.active ? 'entertrim' : 'exittrim', false, this.trimTime);
  }

  // Update UI
  update() {
    if (this.enabled) {
      this.player.debug.log(`trim enabled`);
    } else {
      this.player.debug.log('Trimming is not supported');
    }

    // Add styling hook to show button
    toggleClass(this.player.elements.container, this.player.config.classNames.trim.enabled, this.enabled);
  }

  destroy() {
    // Remove the elements with listeners on
    if (this.elements.container.bar && !is.empty(this.elements.container.bar)) {
      this.elements.container.remove();
    }

    this.player.off('timeupdate', this.timeUpdateFunction);
  }

  // Enter trim tool
  enter() {
    if (!this.enabled) {
      return;
    }
    this.trimming = true;
    this.showTrimTool();

    this.onChange();
  }

  // Exit trim tool
  exit() {
    if (!this.enabled) {
      return;
    }
    this.trimming = false;
    this.hideTrimTool();

    this.onChange();
  }

  // Toggle state
  toggle() {
    if (!this.active) {
      this.enter();
    } else {
      this.exit();
    }
  }
}

export default Trim;
