/** Architecture rules, enforced by `pnpm check:architecture` (and CI). */
const MODULE = '^src/modules/([^/]+)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        'domain/ may only import other files of its own domain/ (and Node core modules). ' +
        'No frameworks, ORMs, other layers or shared code.',
      severity: 'error',
      from: { path: `${MODULE}/domain` },
      to: {
        pathNot: [`^src/modules/$1/domain`],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'application-depends-on-domain-only',
      comment:
        'application/ may only import its own domain/ and application/ (ports, use cases). ' +
        'Adapters are wired from outside.',
      severity: 'error',
      from: { path: `${MODULE}/application` },
      to: {
        pathNot: [`^src/modules/$1/(domain|application)`],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'interface-does-not-reach-infrastructure',
      comment: 'Controllers talk to use cases, never to adapters.',
      severity: 'error',
      from: { path: `${MODULE}/interface` },
      to: { path: `^src/modules/$1/infrastructure` },
    },
    {
      name: 'shared-does-not-depend-on-modules',
      comment: 'shared/ is a dependency of feature modules, never the other way around.',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/modules' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '\\.spec\\.ts$' },
  },
};
