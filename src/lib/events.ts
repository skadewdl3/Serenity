import mitt from "mitt";

type Events = {
  nextPage: void;
  prevPage: void;
  zoomIn: void;
  zoomOut: void;
  resetZoom: void;
  fitToWidth: void;
  goBack: void;
  pdfLoaded: any;
  selectionChange: string;
  selectionClear: void;
  lookupSelection: void;
  openToolbarDrawer: void;
  zoomChanged: number;
  toggleToolbar: void;
};

const emitter = mitt<Events>();

export default emitter;
