import {create} from "zustand";
import {createJSONStorage, persist} from "zustand/middleware";

// An admin on the phone sees their own screens (Večer lige, Upravljanje ligom…) or the app as players see it ("Prikaz
// igrača", admin-mobile 04, with an Admin button back). Kept for the browser tab, so a reload keeps the view.
export type AdminView = "admin" | "player";

type AdminViewState = {
  view: AdminView;
  setView: (view: AdminView) => void;
};

const useAdminViewStore = create<AdminViewState>()(
  persist(
    (set) => ({
      view: "admin",
      setView: (view) => set({view}),
    }),
    {
      name: "admin-view",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

export default useAdminViewStore;
