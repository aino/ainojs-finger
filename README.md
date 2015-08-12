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
  
    // callback for each change:
    finger.on('change', function(e) {
      console.log(e.value) // index value from 0-[length]
      console.log(e.position) // position value
      this.inner.style.left = e.position + 'px'
    })

    // callback for animation complete:
    finger.on('complete', function(e) {
      console.log(e.index) // index value from 0-[length]
    })

As per 1.2, Finger does not add any requestframe, so you can control it yourself for performance optimizations.
The `run` method calculates the animation and returns a boolean. if the boolean is true, then you can call the run method again in your animation loop. Example:

    (function loop() {
      finger.run() && window.requestAnimationFrame(loop)
    })

Options:

- start (0) - starting point
- duration (600) - animation duration in ms
- dbltap (true) - set to false for faster tap event if doubletap is not used
- mouse (true) - enable mouse interactions
- items (null) - manually set number of items to swipe
- vertical (false) - enables vertical swipe instead of horizontal

Events:

- change - triggers if a change has been detected frame. Event object: *value* and *position*
- page - triggers if a page change will happen, before the animation is complete. Event object: *index*
- complete - triggers when animation is complete. Event object: *index*
- tap - triggers when a tap is detected. Event object: *target*
- dbltap - triggers when a doubbletap is detected. Event object: *target*