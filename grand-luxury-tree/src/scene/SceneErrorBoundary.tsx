import type { ReactNode } from 'react';
import { Component } from 'react';

type SceneErrorBoundaryProps = {
  children: ReactNode;
};

type SceneErrorBoundaryState = {
  error: Error | null;
};

export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="scene-error">
          <div className="scene-error-card">
            <div className="scene-error-title">Scene failed to render</div>
            <div className="scene-error-body">{this.state.error.message}</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
