import mitt from "mitt";

export interface RecentFile {
  path: string;
  uri: string;
  file_type: string;
  name: string;
  lastOpened?: number;
  pageNumber?: number;
}

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
  createRecentsEntry: RecentFile;
  editRecentsEntry: Partial<RecentFile> & { path: string };
  deleteRecentsEntry: string; // path
};

const emitter = mitt<Events>();

export default emitter;
