// Input validation utilities for API security

export interface ValidationError {
  field: string;
  message: string;
}

export function validatePrompt(prompt: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof prompt !== "string") {
    errors.push({ field: "prompt", message: "prompt must be a string" });
    return errors;
  }

  if (prompt.trim().length === 0) {
    errors.push({ field: "prompt", message: "prompt cannot be empty" });
  }

  if (prompt.length < 10) {
    errors.push({ field: "prompt", message: "prompt must be at least 10 characters" });
  }

  if (prompt.length > 10000) {
    errors.push({ field: "prompt", message: "prompt cannot exceed 10000 characters" });
  }

  return errors;
}

export function validateResponse(response: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (response !== undefined && response !== null) {
    if (typeof response !== "string") {
      errors.push({ field: "response", message: "response must be a string" });
      return errors;
    }

    if (response.length > 50000) {
      errors.push({ field: "response", message: "response cannot exceed 50000 characters" });
    }
  }

  return errors;
}

export function validateModel(model: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (model !== undefined && model !== null) {
    if (typeof model !== "string") {
      errors.push({ field: "model", message: "model must be a string" });
      return errors;
    }

    const validModels = ["gemini-2.5-flash", "gemini-2.5-pro", "gpt-4", "gpt-3.5-turbo"];
    if (!validModels.includes(model)) {
      errors.push({
        field: "model",
        message: `model must be one of: ${validModels.join(", ")}`,
      });
    }
  }

  return errors;
}

export function validateProject(project: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (project !== undefined && project !== null) {
    if (typeof project !== "string") {
      errors.push({ field: "project", message: "project must be a string" });
      return errors;
    }

    if (project.length > 100) {
      errors.push({ field: "project", message: "project cannot exceed 100 characters" });
    }

    if (!/^[a-zA-Z0-9\-_]+$/.test(project)) {
      errors.push({
        field: "project",
        message: "project must only contain alphanumeric characters, hyphens, and underscores",
      });
    }
  }

  return errors;
}