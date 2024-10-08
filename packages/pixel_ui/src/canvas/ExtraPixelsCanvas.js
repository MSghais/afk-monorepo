import './ExtraPixelsCanvas.css';

import React from 'react';

const ExtraPixelsCanvas = (props) => {
  return (
    <canvas
      ref={props.extraPixelsCanvasRef}
      width={props.width}
      height={props.height}
      style={props.style}
      className="ExtraPixelsCanvas"
      onClick={props.pixelClicked}
    />
  );
};

export default ExtraPixelsCanvas;
