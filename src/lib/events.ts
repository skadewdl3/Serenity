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
  refreshRecents: void;
};

const emitter = mitt<Events>();

export function setupGlobalHandlers(router: any, store: any) {
  emitter.on("goBack", () => {
    console.log("[Events] Global goBack received");
    const targetRoute = store.handleBackButton();
    console.log("[Events] Target route:", targetRoute);

    if (targetRoute) {
      router.push({ name: targetRoute });
    }
  });
}

export default emitter;
