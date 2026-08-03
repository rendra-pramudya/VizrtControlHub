using System;
using System.IO;
using System.Net;
using System.Text;
using System.Xml;

namespace ElementUpdating
{
    class ElementUpdatingExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public ElementUpdatingExample()
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

        private string ConvertXmlDocumentToString(XmlDocument doc)
        {
            StringWriter sw = new StringWriter();
            XmlTextWriter tx = new XmlTextWriter(sw);
            doc.WriteTo(tx);
            return sw.ToString();
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

        private void SetValueToDocumentByXPath(XmlDocument doc, string xpath, string value)
        {
            var nav = doc.CreateNavigator();
            var it = nav.Select(xpath, nameSpaceManager_);
            if (it.MoveNext())
            {
                it.Current.SetValue(value);
            }
        }

        // Assume that the element is at the fist entry of the playlist.
        private string GetElementCollectionEntryUriUnderPlaylist(string showName, string playlistName)
        {
            // Get service document.
            var serviceDoc = LoadXMLFromUri("http://127.0.0.1:8580/");

            // Extract directory uri.
            string directoryUri = GetValueFromDocumentByXPath(serviceDoc,
                "//app:service/app:workspace/app:collection[app:categories/atom:category[@term='directory']]/@href");

            // Get directory document.
            var directoryDoc = LoadXMLFromUri(directoryUri);

            // Extract directory/shows uri.
            string directoryShowUri = GetValueFromDocumentByXPath(directoryDoc,
                "//atom:feed/atom:entry[atom:category[@term='directory'] and atom:title[text()='shows']]/atom:link[@rel='alternate']/@href");

            // Get directory/shows document.
            var directoryShowDoc = LoadXMLFromUri(directoryShowUri);

            // Extract show uri from the given showName.
            string myShowUri = GetValueFromDocumentByXPath(directoryShowDoc,
                "//atom:feed/atom:entry[atom:title[text()='" + showName + "']]/atom:link[@rel='alternate']/@href");

            // Get show document.
            var myShowDoc = LoadXMLFromUri(myShowUri);

            // Extract directory/playlists uri.
            string directoryPlaylistUri = GetValueFromDocumentByXPath(myShowDoc,
                "//atom:feed/atom:entry[atom:category[@term='directory']]/atom:link[@rel='alternate']/@href");

            // Get directory/playlsts document.
            var directoryPlaylistDoc = LoadXMLFromUri(directoryPlaylistUri);

            // Extract element collection uri which is playlist in this case.
            string elementCollectionUri = GetValueFromDocumentByXPath(directoryPlaylistDoc,
                "//atom:feed/atom:entry[atom:category[@term='element_collection'] and atom:title[text()='" +
                    playlistName + "']]/atom:link[@rel='alternate']/@href");

            // Get element collection document.
            var elementCollectionDoc = LoadXMLFromUri(elementCollectionUri);

            // Extract the first element collection entry uri.
            string elementCollectionEntryUri = GetValueFromDocumentByXPath(elementCollectionDoc,
                "//atom:feed/atom:entry/atom:link[@rel='self']/@href");

            return elementCollectionEntryUri;
        }

        // Element uri is the uri to point to the "Element resource",
        // which is not "Element Collection Entry resource"
        private string GetElementUriUnderPlaylist(string showName, string playlistName)
        {
            string elementCollectionEntryUri = GetElementCollectionEntryUriUnderPlaylist(
                showName, playlistName);

            // Get element collection entry document.
            var elementCollectionEntryDoc = LoadXMLFromUri(elementCollectionEntryUri);

            // Extract element uri.
            string elementUri = GetValueFromDocumentByXPath(elementCollectionEntryDoc,
                "//atom:entry/atom:link[@rel='alternate']/@href");

            return elementUri;
        }

        private HttpWebResponse PutOnUri(string uri, string contentType, string body)
        {
            try
            {
                byte[] bodyBytes = Encoding.UTF8.GetBytes(body);

                var client = (HttpWebRequest)HttpWebRequest.Create(uri);
                client.AllowAutoRedirect = false;
                client.AllowWriteStreamBuffering = false;

                client.Method = "PUT";
                client.ContentType = contentType;
                client.ContentLength = bodyBytes.Length;

                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);
                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }

        public void UpdateConceptOfElement(string concept)
        {
            string elementCollectionEntryUri = GetElementCollectionEntryUriUnderPlaylist("My Show", "My Playlist");

            // Get element collection entry document.
            var elementCollectionEntryDoc = LoadXMLFromUri(elementCollectionEntryUri);

            // Update the concept value of the document.
            SetValueToDocumentByXPath(elementCollectionEntryDoc,
                "//atom:entry/viz:alternative_concept", concept);
            string updatedXMLString = ConvertXmlDocumentToString(elementCollectionEntryDoc);

            // PUT on element collection entry uri with the updated xml string.
            var response = PutOnUri(elementCollectionEntryUri,
                "application/atom+xml", updatedXMLString);
            Console.WriteLine("Response status : " + response.StatusCode + "\n");
        }

        public void UpdateContentOfElement()
        {
            string elementUri = GetElementUriUnderPlaylist("My Show", "My Playlist");

            // Get element document.
            var elementDoc = LoadXMLFromUri(elementUri);

            // Update the data value of the document.
            SetValueToDocumentByXPath(elementDoc,
                "//vdf:payload/vdf:field[@name='01']/vdf:value", "My new headline");
            SetValueToDocumentByXPath(elementDoc,
                "//vdf:payload/vdf:field[@name='02']/vdf:value", "My new designation");
            string updatedXMLString = ConvertXmlDocumentToString(elementDoc);

            // PUT on element  uri with the updated xml string.
            var response = PutOnUri(elementUri,
                "Application/vnd.vizrt.payload+xml;type=element", updatedXMLString);
            Console.WriteLine("Response status : " + response.StatusCode + "\n");
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            ElementUpdatingExample myExample = new ElementUpdatingExample();

            // Update concept of the scene
            Console.Write(
@"This is the element updating example.

To setup environment for this example:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.
3. Load Trio's show ""example_show.trioshow"" in ""TestResources"" folder
   to Viz Trio.

Press enter to update the concept of the scene : ");
            Console.ReadLine();
            myExample.UpdateConceptOfElement("Sports");

            // Update content of the scene.
            Console.Write("Press enter to update the content of the scene : ");
            Console.ReadLine();
            myExample.UpdateContentOfElement();

            Console.WriteLine("Please try to take the element on air and see the changes !!!");
        }
    }
}
