import { mount } from 'svelte';
import App from './App.svelte';
import Bench from './Bench.svelte';
import Embed from './Embed.svelte';
import './shell.css';

const target = document.getElementById('app')!;
const pages: Record<string, typeof App> = { '#bench': Bench, '#embed': Embed };
mount(pages[location.hash] ?? App, { target });
