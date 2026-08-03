using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Xml;

namespace CreatePageUsingDefaultTemplates
{
    class PageCreationFromDefaultTemplateExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public PageCreationFromDefaultTemplateExample()
        {
            nameSpaceManager_ = new XmlNamespaceManager(new NameTable());
            nameSpaceManager_.AddNamespace("viz", "http://www.vizrt.com/atom");
            nameSpaceManager_.AddNamespace("atom", "http://www.w3.org/2005/Atom");
            nameSpaceManager_.AddNamespace("vdf", "http://www.vizrt.com/types");
            nameSpaceManager_.AddNamespace("app", "http://www.w3.org/2007/app");
            nameSpaceManager_.AddNamespace("vaext", "http://www.vizrt.com/atom-ext");
        }

        public string GetShowDirectoryUri(string showName)
        {
            // Get service document.
            var serviceDoc = LoadXMLFromUri("http://127.0.0.1:8580");

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

            return myShowUri;
        }
     
        public string GetPlaylistUri(string showUri)
        {
            // Get the document from show uri.
            var showDoc = LoadXMLFromUri(showUri);

            // Extract playlist directory uri.
            string showElementUri = GetValueFromDocumentByXPath(showDoc,
                "//atom:feed/atom:entry[atom:category[@term='directory'] and atom:title[text()='DemoShow playlists']]/atom:link[@rel='alternate']/@href");

            // Get playlist directory document.
            var playlistDoc = LoadXMLFromUri(showElementUri);

            // Get the playlist collection uri
            string playlistCollectionUri = GetValueFromDocumentByXPath(playlistDoc,
                "//atom:feed/atom:entry/atom:link[@rel='alternate']/@href"); 

            // Get the playlist collection document.
            var playlistCollectionDocDoc = LoadXMLFromUri(playlistCollectionUri);

            // Get the self url.
            string plylistCollectionUri = GetValueFromDocumentByXPath(playlistCollectionDocDoc,
                "//atom:feed/atom:link[@rel='self']/@href");

            return plylistCollectionUri;
        }

        public string GetShowUri(string showUri)
        {
            // Get the document from show uri.
            var myShowDoc = LoadXMLFromUri(showUri);

            // Extract show uri.
            string ShowElementUri = GetValueFromDocumentByXPath(myShowDoc,
                "//atom:feed/atom:entry[atom:category[@term='element_collection']]/atom:link[@rel='alternate']/@href");

            return ShowElementUri;
        }

        public string GetDefaultTemplateModelUri(string name)
        {
            // Get service document.
            var serviceDoc = LoadXMLFromUri("http://127.0.0.1:8580");

            // Extract defaultTemplate uri.
            string defaultTemplateUri = GetValueFromDocumentByXPath(serviceDoc,
                "//app:service/app:workspace/app:collection[app:categories/atom:category[@term='default-templates']]/@href");

            // Get defaultTemplate.
            var defaultTemplateDoc = LoadXMLFromUri(defaultTemplateUri);

            // Extract default-template form "name".
            string defaultTemplatePlaylistUri = GetValueFromDocumentByXPath(defaultTemplateDoc,
                 "//atom:feed/atom:entry[atom:title[text()='" + name + "']]/atom:link[@rel='alternate']/@href");

            return defaultTemplatePlaylistUri;
        }

        private string GetVDFFirstField(string modelUri)
        { 
            // Get the document (assume that the document is VDF).
            var modelDoc = LoadXMLFromUri(modelUri);
       
            // Get the First field.
            return GetValueFromDocumentByXPath(modelDoc,
                "//vdf:model/vdf:schema/vdf:fielddef/@name");
        }

        private string ConstructVDFPayload(string modelUri,
            Dictionary<string, string> fields)
        {
            StringBuilder sb = new StringBuilder();

            sb.Append("<payload xmlns=\"http://www.vizrt.com/types\" model=\"" + modelUri + "\">");
            foreach (var item in fields)
            {
                sb.Append(string.Format(
                    "<field name=\"{0}\"><value>{1}</value></field>",
                    item.Key, item.Value));
            }
            sb.Append("</payload>");

            return sb.ToString();
        }

        public string CreatePayload(string templateUri, string playlistUri)
        {
            // Create the Field's value for Playlist-start.
            Dictionary<string, string> fields = new Dictionary<string, string>();

            /*
            For simplicity, get only the first field because the model that we use looks like follows
            <?xml version='1.0' encoding='UTF-8'?>
            <model xmlns="http://www.vizrt.com/types">
                <schema>
                    <fielddef name="playlist" label="Playlist To Start" tip="Path to the playlist to be started." mediatype="text/plain">
                        <mandatory />
                        <regex>..*</regex>
                    </fielddef>
                </schema>
            </model>
            */
            fields.Add(GetVDFFirstField(templateUri), playlistUri);

            // Create the body using the existed field.
            return ConstructVDFPayload(templateUri, fields);
        }

        public void CreatePage(string showUri, string payload)
        {
            var response = PostOnUri(showUri, payload);
            Console.WriteLine("Response status : " + response.StatusCode + "\n");
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

        private HttpWebResponse PostOnUri(string uri, string body)
        {
            try
            {
                byte[] bodyBytes = Encoding.UTF8.GetBytes(body);

                var client = (HttpWebRequest)HttpWebRequest.Create(uri);
                client.AllowAutoRedirect = false;
                client.AllowWriteStreamBuffering = false;

                client.Method = "POST";
                client.ContentType = "application/vnd.vizrt.payload+xml;type=element";
                client.ContentLength = bodyBytes.Length;

                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);
                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.Write(
@"This is the CreatePageUsingDefaultTemplates example.

To setup environment for this example:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.
3. Load Trio's show ""example_show.trioshow"" in ""TestResources"" folder
   to Viz Trio.

Press enter to create a page with 'playlist-start' as a default template. ");
            Console.ReadLine();

            PageCreationFromDefaultTemplateExample myExample =
                new PageCreationFromDefaultTemplateExample();

            // 1. Get uri of show directory named "DemoShow".
            string dirShowUri = myExample.GetShowDirectoryUri("DemoShow");
            
            // 1.1. Get uri of a show under "DemoShow" directory.
            string showUri = myExample.GetShowUri(dirShowUri);

            // 1.2. Get uri of the first playlist in show "DemoShow".
            // The playlist that we want to start.
            string playlistUri = myExample.GetPlaylistUri(dirShowUri);
            
            // 2. Get uri of "Playlist-start" default template.
            string defaultTemplateModelUri = myExample.GetDefaultTemplateModelUri(
                "playlist-start");

            // 3. Create a payload based on the model retrieved from steps 2 for posting to the show.
            // The data of the payload in this case is a http uri of a playlist that we want to take action on.
            string payload = myExample.CreatePayload(defaultTemplateModelUri, playlistUri);

            // 4. Invoke the Http-post method by apply the result from (1.1) and (3).
            myExample.CreatePage(showUri, payload);

            Console.WriteLine(
@"At this point, The playlist-start should be created.
You can test it by doing a ""direct take"" on it, the playlist named DemoPlaylist should start playing its elements.
Thank you for using this example.
");
        }
    }
}
