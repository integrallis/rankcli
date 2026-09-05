// Deno-bundle-only: loadRecipe() falls back to fs.readFileSync against the
// recipes/*.yaml files, which only exist on disk in local dev / the npm
// package tree - not in a deployed Supabase Edge Function's bundle. This
// embeds every recipe's raw YAML as a string literal at bundle time (via
// build-deno.ts's '.yaml' -> 'text' esbuild loader) and registers it through
// the embedRecipe() escape hatch the suggestion engine already exposed for
// exactly this case but that nothing was ever calling.
import { embedRecipe } from './suggestion-engine.js';
import reactYaml from './recipes/react.yaml';
import nextjsYaml from './recipes/nextjs.yaml';
import vueYaml from './recipes/vue.yaml';
import nuxtYaml from './recipes/nuxt.yaml';
import angularYaml from './recipes/angular.yaml';
import sveltekitYaml from './recipes/sveltekit.yaml';
import astroYaml from './recipes/astro.yaml';
import railsYaml from './recipes/rails.yaml';
import djangoYaml from './recipes/django.yaml';
import laravelYaml from './recipes/laravel.yaml';
import wordpressYaml from './recipes/wordpress.yaml';

embedRecipe('react', reactYaml);
embedRecipe('nextjs', nextjsYaml);
embedRecipe('vue', vueYaml);
embedRecipe('nuxt', nuxtYaml);
embedRecipe('angular', angularYaml);
embedRecipe('sveltekit', sveltekitYaml);
embedRecipe('astro', astroYaml);
embedRecipe('rails', railsYaml);
embedRecipe('django', djangoYaml);
embedRecipe('laravel', laravelYaml);
embedRecipe('wordpress', wordpressYaml);
