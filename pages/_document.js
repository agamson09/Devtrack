import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('devtrack_theme')==='light')document.documentElement.classList.add('light')}catch(e){}",
          }}
        />
        <link rel="stylesheet" href="/fonts/all.min.css" />
        <link rel="icon" type="image/webp" href="/favicon.webp" />
        <link rel="shortcut icon" type="image/webp" href="/favicon.webp" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111827" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DevTrack" />
        <link rel="apple-touch-icon" href="/favicon.webp" />
      </Head>
      <body className="bg-gray-900 text-white transition-colors duration-200">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
