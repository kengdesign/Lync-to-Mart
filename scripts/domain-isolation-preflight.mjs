import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Offline validation only: this script never calls Cloudflare or changes DNS.
// Provider-side inventory and token scope must also be verified before provisioning.
export function validateIsolation(config) {
  const errors=[];
  const host=value=>typeof value==='string' && value===value.toLowerCase() && value.length<=253 && value.split('.').length>=2 && value.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x));
  const within=(name,zone)=>name===zone || name.endsWith('.'+zone);
  const zone=config.providerZone;
  if(!host(zone)) errors.push('A dedicated providerZone is required.');
  else {
    if(['lyncto.link','logintimate.com'].some(x=>within(zone,x))) errors.push('Existing service zones and their subdomains cannot be the provider zone.');
    for(const field of ['cnameTarget','fallbackOrigin']) {
      if(!host(config[field]) || !within(config[field],zone) || config[field]===zone) errors.push(field+' must be a dedicated hostname inside the new provider zone.');
    }
    if(host(config.testHostname) && within(config.testHostname,zone)) errors.push('Test customer hostname must be outside the provider zone.');
  }
  if(!/^[a-f0-9]{32}$/.test(config.providerZoneId||'')) errors.push('A verified provider zone ID is required.');
  if(!['lync-to-mart-domain-gateway-staging','lync-to-mart-domain-gateway-production'].includes(config.gatewayWorker)) errors.push('Only dedicated Mart gateway Worker names are allowed.');
  if(!host(config.testHostname)) errors.push('A customer test hostname is required.');
  if(!Number.isSafeInteger(config.maxHostnames) || config.maxHostnames<1) errors.push('An explicit positive hostname cap is required.');
  if(!Number.isSafeInteger(config.availableCapacity) || config.availableCapacity<config.maxHostnames) errors.push('Verified available capacity must cover the cap.');
  return errors;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const errors=validateIsolation(JSON.parse(readFileSync(process.argv[2],'utf8')));
    if(errors.length) {console.error(errors.join('\n'));process.exitCode=1;}
    else console.log('Offline isolation checks passed. No infrastructure changed. Verify provider inventory and token permissions before deployment.');
  } catch {console.error('Provide a readable JSON configuration file.');process.exitCode=1;}
}
