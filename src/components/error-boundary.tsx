"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug } from "lucide-react";
import Link from "next/link";

/**
 * Error Boundary Component
 * 
 * Catches runtime errors gracefully and displays a professional error UI.
 * Provides options to retry or navigate home.
 * Logs errors for debugging and monitoring.
 * 
 * USAGE:
 * ```tsx
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorFallbackProps {
  error: Error | null;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Default error ID for tracking
let errorIdCounter = 0;

class ErrorBoundaryClass extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
    this.resetErrorBoundary = this.resetErrorBoundary.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Generate unique error ID for tracking
    const errorId = `ERR-${Date.now()}-${++errorIdCounter}`;
    
    // Log error details
    console.group(`[${errorId}] Error Boundary Caught an Error`);
    console.error("Error:", error);
    console.error("Error Info:", errorInfo);
    console.error("Component Stack:", errorInfo.componentStack);
    console.groupEnd();

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you would send this to your error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
    
    // Store error ID in state for display
    this.setState((prevState) => ({
      ...prevState,
      error: new Error(`${error.message} [ID: ${errorId}]`),
    }));
  }

  resetErrorBoundary() {
    this.setState({
      hasError: false,
      error: null,
    });
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || DefaultErrorFallback;
      return (
        <Fallback
          error={this.state.error}
          resetErrorBoundary={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback Component
 */
function DefaultErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  // Extract error ID if present
  const errorMessage = error?.message || "An unexpected error occurred";
  const errorMatch = errorMessage.match(/\[ID: ([^\]]+)\]/);
  const errorId = errorMatch ? errorMatch[1] : null;
  const displayMessage = errorMessage.replace(/\s*\[ID: [^\]]+\]/, "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border-destructive/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Something went wrong
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            We apologize for the inconvenience. An unexpected error has occurred.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* User-friendly error message */}
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium text-foreground">{displayMessage}</p>
            {errorId && (
              <p className="mt-1 text-xs text-muted-foreground">
                Error Reference: <code className="font-mono">{errorId}</code>
              </p>
            )}
          </div>

          {/* Expandable error details */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full text-xs"
          >
            <Bug className="mr-2 h-3 w-3" />
            {showDetails ? "Hide" : "Show"} technical details
          </Button>

          {showDetails && error && (
            <div className="rounded-md border bg-background p-3 max-h-40 overflow-y-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                {error.stack || error.message}
              </pre>
            </div>
          )}

          {/* Help text */}
          <p className="text-xs text-center text-muted-foreground">
            If this problem persists, please contact support with the error reference above.
          </p>
        </CardContent>

        <CardFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="default"
            onClick={resetErrorBoundary}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </Link>
          
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Standalone Error Page Component
 * For use in error.tsx files or as a direct component
 */
export function ErrorPage({
  error,
  reset,
  statusCode = 500,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  statusCode?: number;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application Error:", error);
  }, [error]);

  const errorMessage = error?.message || "An unexpected error occurred";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border-destructive/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-2xl font-bold text-destructive">{statusCode}</span>
          </div>
          <CardTitle className="text-xl text-foreground">
            {statusCode === 500 ? "Internal Server Error" : "An Error Occurred"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            We apologize for the inconvenience. The application encountered an error.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium text-foreground">{errorMessage}</p>
            {error?.digest && (
              <p className="mt-1 text-xs text-muted-foreground">
                Error ID: <code className="font-mono">{error.digest}</code>
              </p>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This issue has been logged automatically. If it continues, please contact support.
          </p>
        </CardContent>

        <CardFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
          {reset && (
            <Button
              variant="default"
              onClick={reset}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Network Error Component
 * Displayed when API requests fail
 */
export function NetworkError({
  message = "Unable to connect to the server",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-warning/20">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="font-medium text-foreground">Connection Error</h4>
            <p className="text-sm text-muted-foreground">{message}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-2"
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Not Authorized Component
 * Displayed when user lacks permissions
 */
export function NotAuthorized({
  message = "You don't have permission to access this resource",
  onGoBack,
}: {
  message?: string;
  onGoBack?: () => void;
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-muted-foreground"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <CardTitle className="text-lg">Access Denied</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          {onGoBack ? (
            <Button variant="outline" onClick={onGoBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          ) : (
            <Link href="/">
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// Export the main ErrorBoundary component as default
export default ErrorBoundaryClass;

// Export useful types
export type { ErrorBoundaryProps, ErrorFallbackProps };
