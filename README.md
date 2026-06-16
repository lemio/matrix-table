Please try at https://lemio.github.io/matrix-table/

https://github.com/user-attachments/assets/b667b8a5-9056-4b47-80c1-2a57ffb2d893

A Matrix you could see as a grid of rows of a table. So each cell in the Matrix contains a row in a table. In this way, it is easier to compare and edit batches of rows. It allows you to order rows of a table in certain ways. This can make it easier to compare differences among certain critical variables. You might want to look at the origin on the Y axis and the arrival time on the X axis. You might want to track which trains are delayed and on which track they are delayed. Generally speaking, the Y axis is nice for textual elements, since we have horizontal writing; the X axis is good for numbered content, or time-related properties. Since we read from left to right; we also expect time to go from left to right.

The style of a matrix is as minimal as possible. The position of the elements is already conveying two properties of them. For the axises they can be scatter style (the value defines the exact position), or aligned styles (the value defines the order in which they are showed, but the alignment is forcing it to be next to the previous value. The scatter style has a risk that multiple items can be overlapping (since the properties that define X and Y might occur more often); this will be shown by applying an opacity to the whole visualisation.

The colour and content of a matrix cell is defined by the user though conditional styles. They can assign for example an ordinal colour to a string (e.g. type of train); a shape to a string; show the first few letters of a string; a linear colour gradient to a value (e.g. the delay) change the size of the shape by a value, or show the value as a number.

When showing values, numbers etc. They are rendered in such a way that they are easy to compare. Tnum will always be switched on. Number with decimals will be aligned right until the comma, and right after the comma.

This allows flexibility, while still keeping the visual clutter low compared to trying to show everything. Users can navigate between different X and Y axises and through different conditional styles to make sense of the data.

https://github.com/user-attachments/assets/e713d8e0-faa7-446c-93b1-102173b57890

## Related projects / Inspirations

https://worrydream.com/MagicInk/

https://simplexct.com/data-ink-ratio-tables

https://youtu.be/TbsfvdZXE7s?si=fJYFvywy9NcOItaI&t=259

https://vimeo.com/695905306




