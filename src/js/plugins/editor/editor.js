import controls from '../../controls';
import ui from '../../ui';
import { createElement, insertAfter, toggleHidden } from '../../utils/elements';
import { on, triggerEvent } from '../../utils/events';
import i18n from '../../utils/i18n';
import is from '../../utils/is';
import { clamp } from '../../utils/numbers';
import { formatTime } from '../../utils/time';

class Editor {
  constructor(player) {
    // Keep reference to parent
    this.player = player;
    this.config = player.config.editor;
    this.loaded = false;
    this.shown = false;
    this.seeking = false;
    this.timeline = {
      lowerSeek: 10,
      upperSeek: 90,
      upperPlaying: 60,
      scrollSpeed: 1.5,
    };
    this.videoContainerWidth = 123;
    this.zoom = {
      scale: 1,
    };
    this.numOfTimestamps = 5;
    this.elements = {
      container: {},
    };

    this.load();
  }

  // Determine if Editor is enabled
  get enabled() {
    const { config, player } = this;
    return config.enabled && player.isHTML5 && player.isVideo;
  }

  // Get active state
  get active() {
    if (!this.enabled) {
      return false;
    }

    return this.shown;
  }

  load() {
    on.call(this.player, document, () => {
      this.onChange();
    });

    // Player listeners
    this.listeners();

    // Update the UI
    this.update();
  }

  showEditor() {
    if (is.empty(this.elements.container)) {
      this.createEditor();
    }

    toggleHidden(this.elements.container, false);
  }

  hideEditor() {
    toggleHidden(this.elements.container, true);
  }

  createEditor() {
    const { container } = this.player.elements;
    if (is.element(container) && this.loaded) {
      this.createContainer(container);
      this.createControls();
      this.createTimeline();
      this.createTimeStamps();
      this.createVideoTimeline();
      this.createSeekHandle();
      this.player.listeners.editor();
    }
  }

  createContainer(container) {
    this.elements.container = createElement('div', {
      class: this.player.config.classNames.editor.container,
    });

    insertAfter(this.elements.container, container);

    // Add style hook
    ui.addStyleHook.call(this.player, this.elements.container);
  }

  createControls() {
    const { container } = this.elements;

    // Create controls container
    container.controls = createElement('div', {
      class: this.player.config.classNames.editor.controls,
    });

    container.appendChild(container.controls);

    // Create time container
    container.controls.timeContainer = createElement('div', {
      class: `plyr__controls__item ${this.player.config.classNames.editor.timeContainer}`,
    });

    container.controls.appendChild(container.controls.timeContainer);

    // Create time container - Seperate time container needed from video as each item needs a unqiue key
    container.controls.timeContainer.time = controls.createTime.call(this.player, 'editorCurrentTime', {
      class: `plyr__controls__item ${this.player.config.classNames.editor.time}`,
    });

    container.controls.timeContainer.appendChild(container.controls.timeContainer.time);

    // Create zoom slider container
    container.controls.zoomContainer = createElement('div', {
      class: `plyr__controls__item ${this.player.config.classNames.editor.zoomContainer}`,
    });

    container.controls.appendChild(container.controls.zoomContainer);

    // Create minus icon
    container.controls.zoomContainer.zoomOut = controls.createButton.call(
      this.player,
      'zoomOut',
      'plyr__controls__item',
    );
    container.controls.zoomContainer.appendChild(container.controls.zoomContainer.zoomOut);

    // Create zoom slider
    container.controls.zoomContainer.zoom = controls.createRange.call(this.player, 'zoom', {
      id: `plyr__editor__zoom`,
      step: 0.1,
      min: 1,
      max: 4,
      value: 1,
      'aria-valuemin': 1,
      'aria-valuemax': 4,
      'aria-valuenow': 1,
    });

    container.controls.zoomContainer.appendChild(container.controls.zoomContainer.zoom);

    // Create plus icon
    container.controls.zoomContainer.zoomIn = controls.createButton.call(this.player, 'zoomIn', 'plyr__controls__item');
    container.controls.zoomContainer.appendChild(container.controls.zoomContainer.zoomIn);
  }

  createTimeline() {
    const { container } = this.elements;
    this.elements.container.timeline = createElement('div', {
      class: this.player.config.classNames.editor.timeline,
    });

    container.appendChild(this.elements.container.timeline);

    this.elements.container.timeline.style.width = '100%';
    this.elements.container.timeline.style.left = '0%';
  }

  createTimeStamps() {
    const step = this.player.duration / this.numOfTimestamps;
    const { timeline } = this.elements.container;
    const timeStamps = [];

    timeline.timestampsContainer = createElement('div', {
      class: this.player.config.classNames.editor.timeStampsContainer,
    });

    timeline.appendChild(timeline.timestampsContainer);

    for (let i = 0; i < this.numOfTimestamps; i += 1) {
      const timeStamp = createElement(
        'span',
        { class: this.player.config.classNames.editor.timeStamp },
        formatTime(Math.round(step * i)),
      );
      // Append the element to the timeline
      timeline.timestampsContainer.appendChild(timeStamp);
      // Add the element to the list of elements
      timeStamps.push(timeStamp);
    }

    // Add list of timestamps to elements object
    timeline.timestampsContainer.timeStamps = timeStamps;
  }

  createVideoTimeline() {
    const { timeline } = this.elements.container;

    // Create video timeline wrapper
    timeline.videoContainerParent = createElement('div', {
      class: this.player.config.classNames.editor.videoContainerParent,
    });

    timeline.appendChild(timeline.videoContainerParent);

    // Create video timeline
    timeline.videoContainerParent.videoContainer = createElement('div', {
      class: this.player.config.classNames.editor.videoContainer,
    });

    timeline.videoContainerParent.appendChild(timeline.videoContainerParent.videoContainer);

    this.setVideoTimelimeContent();
  }

  setVideoTimelimeContent() {
    const { previewThumbnails } = this.player;
    const { timeline } = this.elements.container;
    // Total number of images needed to fill the timeline width
    const clientRect = timeline.getBoundingClientRect();
    const { videoContainer } = timeline.videoContainerParent;
    const imageCount = Math.ceil(clientRect.width / this.videoContainerWidth);
    let time = 0;

    if (is.nullOrUndefined(videoContainer.previewThumbs)) {
      videoContainer.previewThumbs = [];
    }

    // Enable editor mode in preview thumbnails
    if (previewThumbnails) {
      previewThumbnails.editor = true;
    }

    // Append images to video timeline
    for (let i = 0; i < imageCount; i += 1) {
      let previewThumb;

      if (is.nullOrUndefined(videoContainer.previewThumbs[i])) {
        // Create new image wrapper
        previewThumb = createElement('span', {
          class: this.player.config.classNames.editor.previewThumb,
        });
        // Append new image wrapper to the timeline
        videoContainer.appendChild(previewThumb);
        videoContainer.previewThumbs.push(previewThumb);
      } else {
        // Retrieve the existing container
        previewThumb = videoContainer.previewThumbs[i];
      }

      // If preview thumbnails is enabled append an image to the previewThumb
      if (previewThumbnails) {
        // set the current editor container
        previewThumbnails.elements.editor.container = previewThumb;

        // Append the image to the container
        previewThumbnails.showImageAtCurrentTime(time);
      }

      time += this.player.duration / (clientRect.width / this.videoContainerWidth);
    }

    if (previewThumbnails) {
      // Disable editor mode in preview thumbnails
      previewThumbnails.editor = false;

      // Once all images are loaded remove the container from the preview thumbs
      previewThumbnails.elements.editor = {};
    }

    // Once all images are loaded set the width of the parent video container to display them
    videoContainer.style.width = `${imageCount * this.videoContainerWidth}px`;
  }

  createSeekHandle() {
    const { timeline } = this.elements.container;
    const duration = controls.formatTime(this.player.duration);

    // Create seek Container
    timeline.seekHandle = createElement('div', {
      class: this.player.config.classNames.editor.seekHandle,
      role: 'slider',
      'aria-valuemin': 0,
      'aria-valuemax': duration,
      'aria-label': i18n.get('seek', this.player.config),
    });

    // Create seek head
    timeline.seekHandle.head = createElement('div', {
      class: this.player.config.classNames.editor.seekHandleHead,
    });

    // Create seek line
    timeline.seekHandle.line = createElement('div', {
      class: this.player.config.classNames.editor.seekHandleLine,
    });

    timeline.appendChild(timeline.seekHandle);
    timeline.seekHandle.appendChild(timeline.seekHandle.head);
    timeline.seekHandle.appendChild(timeline.seekHandle.line);

    this.setSeekPosition();
  }

  setZoom(event) {
    const { timeline } = this.elements.container;
    // Zoom on seek handle position
    const clientRect = timeline.getBoundingClientRect();
    const xPos = timeline.seekHandle.getBoundingClientRect().left;
    const percentage = (100 / clientRect.width) * (xPos - clientRect.left);

    if (!(event.type === 'wheel' || event.type === 'input' || event.type === 'click')) {
      return;
    }

    // Calculate zoom Delta for mousewheel
    if (event.type === 'wheel') {
      const delta = clamp(event.deltaY * -1, -1, 1);
      this.zoom.scale += delta * 0.1 * this.zoom.scale;

      // Restrict bounds of zoom for wheel
      if ((this.zoom.scale === 4 && delta < 0) || (this.zoom.scale === 1 && delta > 0)) {
        return;
      }

      // Calculate zoom level based on zoom slider
    } else if (event.type === 'input') {
      const { value } = event.target;
      this.zoom.scale = value;
    } else if (event.type === 'click') {
      if (event.target === this.elements.container.controls.zoomContainer.zoomIn) {
        this.zoom.scale += 1;
      } else {
        this.zoom.scale -= 1;
      }
    }

    // Limit zoom to be between 1 and 4 times zoom
    this.zoom.scale = clamp(this.zoom.scale, 1, 4);

    // Apply zoom scale
    timeline.style.width = `${this.zoom.scale * 100}%`;
    // Position the element based on the mouse position
    timeline.style.left = `${(-(this.zoom.scale * 100 - 100) * percentage) / 100}%`;

    // Update slider
    if (is.element(this.elements.container.controls.zoomContainer)) {
      controls.setRange.call(this.player, this.elements.container.controls.zoomContainer.zoom, this.zoom.scale);
    }

    // Update timeline images
    this.setVideoTimelimeContent();
  }

  setSeeking(event) {
    const { classList } = event.target;
    const { leftThumb, rightThumb } = this.player.config.classNames.trim;
    const { marker } = this.player.config.classNames.markers;

    // Disable seeking event if selecting the trimming tool or a marker on the timeline
    if (classList.contains(leftThumb) || classList.contains(rightThumb) || classList.contains(marker)) {
      return;
    }

    // Only act on left mouse button (0), or touch device (event.button does not exist or is false)
    if (!(is.nullOrUndefined(event.button) || event.button === false || event.button === 0)) {
      return;
    }

    if (event.type === 'mousedown' || event.type === 'touchstart') {
      this.seeking = true;
    } else if (event.type === 'mouseup' || event.type === 'touchend') {
      this.seeking = false;
    }
    this.triggerSeekEvent(event);
  }

  triggerSeekEvent(event) {
    if (this.seeking) {
      if (this.player.previewThumbnails) {
        this.player.previewThumbnails.startScrubbing(event);
      }
      triggerEvent.call(this.player, this.player.media, 'seeking');
      this.setSeekTime(event);
    } else if (this.player.previewThumbnails) {
      this.player.previewThumbnails.endScrubbing(event);
    }
  }

  setSeekPosition() {
    if (!this.active || this.seeking) {
      return;
    }
    const { timeline } = this.elements.container;
    const { seek } = this.player.elements.inputs;

    timeline.seekHandle.style.left = `${seek.value}%`;
    this.setTimelineOffset(seek.value);

    const currentTime = controls.formatTime(this.player.currentTime);
    const duration = controls.formatTime(this.player.duration);
    const format = i18n.get('seekLabel', this.player.config);

    // Update aria values
    timeline.seekHandle.setAttribute('aria-valuenow', currentTime);
    timeline.seekHandle.setAttribute(
      'aria-valuetext',
      format.replace('{currentTime}', currentTime).replace('{duration}', duration),
    );
  }

  setSeekTime(event) {
    if (!this.active || !this.seeking) {
      return;
    }

    const { type, touches, pageX } = event;

    if (['mousedown', 'touchstart', 'mousemove', 'touchmove'].includes(type)) {
      const { timeline } = this.elements.container;
      const clientRect = timeline.getBoundingClientRect();
      const xPos = type === 'touchmove' ? touches[0].pageX : pageX;
      const percentage = clamp((100 / clientRect.width) * (xPos - clientRect.left), 0, 100);

      // Set the editor seek position
      timeline.seekHandle.style.left = `${percentage}%`;

      // Update the current video time
      this.player.currentTime = this.player.media.duration * (percentage / 100);

      // Set video seek
      controls.setRange.call(this.player, this.player.elements.inputs.seek, percentage);

      // Set the video seek position
      triggerEvent.call(this.player, this.player.media, 'seeked');

      // Show the seek thumbnail
      if (this.player.previewThumbnails) {
        const seekTime = this.player.media.duration * (percentage / 100);
        this.player.previewThumbnails.showImageAtCurrentTime(seekTime);
      }
    }
  }

  // If the seek handle is near the end of the visible timeline window, shift the timeline
  setTimelineOffset() {
    const { container } = this.elements;
    // Values defining the speed of scrolling and at what points triggering the offset
    const { lowerSeek, upperSeek, upperPlaying, scrollSpeed } = this.timeline;
    // Retrieve the container positions for the container, timeline and seek handle
    const clientRect = container.getBoundingClientRect();
    const timelineRect = container.timeline.getBoundingClientRect();
    const seekPos = container.timeline.seekHandle.getBoundingClientRect();
    // Current position in the editor container
    const zoom = parseFloat(container.timeline.style.width);
    let offset = parseFloat(container.timeline.style.left);
    const seekHandleOffset = parseFloat(container.timeline.seekHandle.style.left);
    // Retrieve the hover position in the editor container, else retrieve the seek value
    const percentage = (100 / clientRect.width) * (seekPos.left - clientRect.left);
    // If playing set lower upper bound to when we shift the timeline
    const upperBound = this.player.playing ? upperPlaying : upperSeek;

    // Calculate the timeline offset position
    if (percentage > upperBound && zoom - offset > 100) {
      offset = Math.max(offset - (percentage - upperBound) / scrollSpeed, (zoom - 100) * -1);
    } else if (percentage < lowerSeek) {
      offset = Math.min(offset - (lowerSeek - percentage) / -scrollSpeed, 0);
    }

    if (offset === parseFloat(container.timeline.style.left)) {
      return;
    }

    // Apply the timeline seek offset
    container.timeline.style.left = `${offset}%`;

    // Retrieve the position of the seek handle after the timeline shift
    const seekPosUpdated = container.timeline.seekHandle.getBoundingClientRect().left;
    const seekPercentage = parseFloat(seekHandleOffset) + (100 / timelineRect.width) * (seekPos.left - seekPosUpdated);

    container.timeline.seekHandle.style.left = `${seekPercentage}%`;

    // Show the corresponding preview thumbnail for the updated seek position
    if (this.seeking && this.player.previewThumbnails) {
      const seekTime = this.player.media.duration * (seekPercentage / 100);
      this.player.previewThumbnails.showImageAtCurrentTime(seekTime);
    }
  }

  listeners() {
    this.player.once('canplay', () => {
      this.loaded = true;
      if (this.shown) {
        this.createEditor();
      }
    });
  }

  // On toggle of the editor, trigger event
  onChange() {
    if (!this.enabled) {
      return;
    }

    // Trigger an event
    triggerEvent.call(this.player, this.player.media, this.active ? 'enterEditor' : 'exitEditor', true);
  }

  // Update UI
  update() {
    if (this.enabled) {
      this.player.debug.log(`trim enabled`);
    } else {
      this.player.debug.log('Trimming is not supported');
    }
  }

  destroy() {
    // Remove the elements with listeners on
    if (this.elements.container && !is.empty(this.elements.container)) {
      this.elements.container.remove();
    }
  }

  // Enter Editor
  enter() {
    if (!this.enabled || this.active) {
      return;
    }
    this.shown = true;
    this.showEditor();

    this.onChange();
  }

  // Exit Editor
  exit() {
    if (!this.enabled || !this.shown) {
      return;
    }
    this.shown = false;
    this.hideEditor();

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

export default Editor;
