// Only resolves as real modules in the Deno bundle build (build-deno.ts sets
// a '.yaml' -> 'text' esbuild loader); this declaration exists purely so
// embed-recipes.ts type-checks under tsup's regular TypeScript build too.
declare module '*.yaml' {
  const content: string;
  export default content;
}
