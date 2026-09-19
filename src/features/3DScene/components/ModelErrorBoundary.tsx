import { Component, type ReactNode } from "react";

export class ModelErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Failed to load rocket model", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
