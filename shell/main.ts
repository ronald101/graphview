import { mount } from 'svelte';
import App from './App.svelte';
import Bench from './Bench.svelte';
import './shell.css';

const target = document.getElementById('app')!;
mount(location.hash === '#bench' ? Bench : App, { target });
