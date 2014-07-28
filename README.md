Finger
------

Swipe/flick physics for touch devices. Usage:

    var finger = Finger(element, options)

The element must be a container that contains another slidecontainer. Example markup:

    <div class="container">
      <div class="slides">
        <div class="slide"></div>
        <div class="slide"></div>
      </div>
    </div>


All CSS must be added manually. Finger implemenets the ainojs-events interface. Example:
  
    // callback for each frame:
    finger.on('frame', function(e) {
      console.log(e.value) // index value from 0-[length]
      console.log(e.position) // position value
      this.inner.style.left = e.position + 'px'
    })

    // callback for animation complete:
    finger.on('complete', function(e) {
      console.log(e.index) // index value from 0-[length]
    })

Options:

- start (0) - starting point
- duration (600) - animation duration in ms
- dbltap (true) - set to false for faster tap event if doubletap is not used

Events:

- frame - triggers every frame. Event object: *value* and *position*
- complete - triggers when animation is complete. Event object: *index*
- tap - triggers when a tap is detected. Event object: *target*
- dbltap - triggers when a doubbletap is detected. Event object: *target*