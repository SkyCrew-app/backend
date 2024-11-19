import { themes } from 'prism-react-renderer';
const lightCodeTheme = themes.github,
  darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'SkyCrew documentation',
  tagline: 'skycrew documentation',
  url: 'https://your-docusaurus-test-site.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: './img/favicon.ico',
  organizationName: 'skycrew',
  projectName: 'skycrew',
  plugins: [
    [
      '@graphql-markdown/docusaurus',
      {
        schema: '../schema.gql',
        rootPath: './docs',
        baseURL: '/',
        homepage: './docs/index.md',
        loaders: {
          GraphQLFileLoader: '@graphql-tools/graphql-file-loader',
        },
      },
    ],
  ],
  presets: [
    [
      'classic',
      {
        blog: false,
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'GraphQL-Markdown',
      logo: {
        alt: 'graphql-markdown',
        src: 'img/graphql-markdown.svg',
      },
      items: [
        {
          href: 'https://github.com/graphql-markdown/graphql-markdown',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} SkyCrew.`,
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
    },
  },
};

export default config;
