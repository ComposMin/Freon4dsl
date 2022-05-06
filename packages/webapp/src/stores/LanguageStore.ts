// info about the language
import {writable} from 'svelte/store';
import type { Writable } from 'svelte/store';

export let languageName: Writable<string> = writable<string>("Language XXX");
export let unitTypes: Writable<string[]> = writable<string[]>([]);
export let fileExtensions: Writable<string[]> = writable<string[]>([]);
export let projectionNames:  Writable<string[]> = writable<string[]>([]);
