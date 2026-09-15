import type { Inspection } from "@/types";
import { MOCK_INSPECTIONS } from "@/lib/mock/inspections";

type Listener = () => void;

const STORAGE_KEY = "thinksphere.mock.inspections.v1";

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

/**
 * In-memory, localStorage-backed mock "database" for demo mode. Mirrors the
 * shape of data a real backend would hold so it can be swapped for actual
 * FastAPI calls (see lib/api) without touching UI code.
 */
class InspectionStore {
  private inspections: Inspection[];
  private listeners = new Set<Listener>();

  constructor() {
    this.inspections = this.load();
  }

  private load(): Inspection[] {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as Inspection[];
      } catch {
        // fall through to defaults
      }
    }
    return clone(MOCK_INSPECTIONS);
  }

  private persist() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.inspections));
      } catch {
        // storage unavailable — demo continues in-memory only
      }
    }
  }

  private emit() {
    this.persist();
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAll(): Inspection[] {
    return this.inspections;
  }

  getById(id: string): Inspection | undefined {
    return this.inspections.find((i) => i.id === id);
  }

  add(inspection: Inspection) {
    this.inspections.unshift(inspection);
    this.emit();
  }

  update(id: string, updater: (draft: Inspection) => Inspection) {
    const idx = this.inspections.findIndex((i) => i.id === id);
    if (idx === -1) return;
    this.inspections[idx] = updater(this.inspections[idx]);
    this.emit();
  }

  reset() {
    this.inspections = clone(MOCK_INSPECTIONS);
    this.emit();
  }
}

export const inspectionStore = new InspectionStore();
