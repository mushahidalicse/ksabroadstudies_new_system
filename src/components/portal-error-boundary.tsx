"use client";

import { Component, type ReactNode } from "react";

type State = { message: string };

export class PortalErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : "This step hit an unexpected error.",
    };
  }

  render() {
    if (!this.state.message) return this.props.children;
    return (
      <div className="panel rounded-3xl p-6 md:p-8 space-y-3">
        <p className="eyebrow">Portal</p>
        <h2 className="display text-3xl">This step could not be shown</h2>
        <p className="text-sm text-[var(--ink-soft)]">{this.state.message}</p>
        <button
          type="button"
          className="btn btn-sea"
          onClick={() => this.setState({ message: "" })}
        >
          Try this step again
        </button>
      </div>
    );
  }
}
