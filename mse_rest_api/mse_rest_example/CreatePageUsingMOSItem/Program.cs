using System;
using System.Net;
using System.Text;
using System.Xml;

namespace CreatePageUsingMOSItem
{
    class PageCreationExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public PageCreationExample()
        {
            nameSpaceManager_ = new XmlNamespaceManager(new NameTable());
            nameSpaceManager_.AddNamespace("viz", "http://www.vizrt.com/atom");
            nameSpaceManager_.AddNamespace("atom", "http://www.w3.org/2005/Atom");
            nameSpaceManager_.AddNamespace("vdf", "http://www.vizrt.com/types");
            nameSpaceManager_.AddNamespace("app", "http://www.w3.org/2007/app");
            nameSpaceManager_.AddNamespace("vaext", "http://www.vizrt.com/atom-ext");
        }

        private XmlDocument LoadXMLFromUri(string uri)
        {
            XmlDocument doc = new XmlDocument();
            doc.Load(uri);
            return doc;
        }

        private string GetValueFromDocumentByXPath(XmlDocument doc, string xpath)
        {
            var nav = doc.CreateNavigator();
            var it = nav.Select(xpath, nameSpaceManager_);
            if (it.MoveNext())
            {
                return it.Current.Value;
            }

            return "";
        }

        // This return the first found playlist
        private string GetElementCollectionUri()
        {
            // Setup directory/playlists uri.
            string directoryPlaylistUri = "http://127.0.0.1:8580/directory/playlists/";

            // Get directory/playlists document.
            var directoryPlaylistDoc = LoadXMLFromUri(directoryPlaylistUri);

            // Extract the directory/playlist imported uri.
            string directoryPlaylistImportedUri = GetValueFromDocumentByXPath(directoryPlaylistDoc,
                "//atom:feed/atom:entry/atom:link[@rel='alternate']/@href");

            // Get directory/playlist imported document.
            var directoryPlaylistImportedDoc = LoadXMLFromUri(directoryPlaylistImportedUri);

            // Extract element collection uri.
            string elementCollectionUri = GetValueFromDocumentByXPath(directoryPlaylistImportedDoc,
                "//atom:feed/atom:entry[atom:category[@term='playlist_collection']]/atom:link[@rel='alternate']/@href");

            return elementCollectionUri;
        }

        private HttpWebResponse PostOnUri(string uri, string body)
        {
            try
            {
                byte[] bodyBytes = Encoding.UTF8.GetBytes(body);

                var client = (HttpWebRequest)HttpWebRequest.Create(uri);
                client.AllowAutoRedirect = false;
                client.AllowWriteStreamBuffering = false;

                client.Method = "POST";
                client.ContentType = "application/vnd.vizrt.mositem+xml";
                client.ContentLength = bodyBytes.Length;

                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);
                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }

        public void CreatePageByUsingMOSItem()
        {
            // Retrieve element collection uri in which to create a page.
            string elementCollectionUri = GetElementCollectionUri();

            // Create MOS item string that refer to the object id "343"
            string mosItem = "<mosObj><objID>343</objID><description>My Page</description></mosObj>";

            // POST to the element collection uri with the MOS item string
            // as a body.
            var response = PostOnUri(elementCollectionUri, mosItem);
            Console.WriteLine("Response status : " + response.StatusCode + "\n");
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine(
@"This is the CreatePageUsingMOSItem example.

To setup environment for this example:
1. Open MSE.
2. Open Director.
3. Go to ""Tools"" -> ""import"".
4. Import ""example_playlist.xml"", in ""TestResources"" folder.
Please preserve the object ids from the exported playlist and do not update any template.

Press enter to create a new page from MOS item with object id = ""343""
in the first found playlist. This object id is contained in the exported playlist.");
            Console.ReadLine();

            PageCreationExample myExample = new PageCreationExample();
            myExample.CreatePageByUsingMOSItem();

            Console.WriteLine(
@"The new created element is ready to use. Please try to run it and do not
forget to configure the playout devices in the profile editor.");
        }
    }
}
