import { describe, expect, it } from "vitest";
import greet, { metadata as greetMeta, schema as greetSchema } from "@/tools/greet";
import reviewCode, { metadata as reviewMeta, schema as reviewSchema } from "@/prompts/review-code";
import appConfig, { metadata as appMeta } from "@/resources/(config)/app";
import userProfile, { metadata as userMeta, schema as userSchema } from "@/resources/(users)/[userId]/index";

// The template's own files, called as xmcp calls them: a default export that
// takes the parsed arguments, beside the schema and metadata xmcp registers.
// No build and no runtime — this is the template's behaviour on its own;
// server.test.ts drives the same files through the built Worker.

describe("the greet tool", () => {
  it("greets by name, as the template does", () => {
    expect(greet({ name: "Ada" })).toBe("Hello, Ada!!");
  });

  it("is registered as a read-only, idempotent tool", () => {
    expect(greetMeta.name).toBe("greet");
    expect(greetMeta.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
  });

  it("takes a string name and nothing else", () => {
    expect(greetSchema.name.safeParse("Ada").success).toBe(true);
    expect(greetSchema.name.safeParse(42).success).toBe(false);
  });
});

describe("the review-code prompt", () => {
  it("asks for a review of the code it is given", () => {
    const text = reviewCode({ code: "let x = 1" });
    expect(text).toContain("Please review this code for:");
    expect(text).toContain("Potential bugs or security issues");
    expect(text).toContain("let x = 1");
  });

  it("is a user-role prompt with one required argument", () => {
    expect(reviewMeta).toMatchObject({ name: "review-code", title: "Review Code", role: "user" });
    expect(reviewSchema.code.safeParse(undefined).success).toBe(false);
  });
});

describe("the resources", () => {
  it("serves the app configuration", () => {
    expect(appMeta.name).toBe("app-config");
    expect(appConfig()).toBe("App configuration here");
  });

  it("serves a user's profile by id", () => {
    expect(userMeta.name).toBe("user-profile");
    expect(userSchema.userId.safeParse("42").success).toBe(true);
    expect(userProfile({ userId: "42" })).toBe("Profile data for user 42");
  });
});
