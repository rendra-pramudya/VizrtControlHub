using System;
using System.Net;
using System.Text;
using System.Xml;

namespace ElementExecution
{
    class ElementExecutionExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public ElementExecutionExample()
        {
            nameSpaceManager_ = new XmlNamespaceManager(new NameTable());
            nameSpaceManager_.AddNamespace("viz", "http://www.vizrt.com/atom");
            nameSpaceManager_.AddNamespace("atom", "http://www.w3.org/2005/Atom");
            nameSpaceManager_.AddNamespace("vdf", "http://www.vizrt.com/types");
            nameSpaceManager_.AddNamespace("app", "http://www.w3.org/2007/app");
            nameSpaceManager_.AddNamespace("vaext", "http://www.vizrt.com/atom-ext");
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

        private string GetElementCollectionUri(string showName)
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

            // Extract element collection uri.
            string elementCollectionUri = GetValueFromDocumentByXPath(myShowDoc,
                "//atom:feed/atom:entry[atom:category[@term='element_collection']]/atom:link[@rel='alternate']/@href");

            return elementCollectionUri;
        }

        private string GetElementEntryUri(string showName, string entryName)
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

            // Extract element collection uri.
            string elementCollectionUri = GetValueFromDocumentByXPath(myShowDoc,
                "//atom:feed/atom:entry[atom:category[@term='element_collection']]/atom:link[@rel='alternate']/@href");

            // Get element collection document.
            var elementCollectionDoc = LoadXMLFromUri(elementCollectionUri);

            // Extract element entry uri from the given entryName.
            string elementEntryUri = GetValueFromDocumentByXPath(elementCollectionDoc,
                "//atom:entry[atom:title[text()='" + entryName + "']]/atom:link[@rel='self']/@href");

            return elementEntryUri;
        }

        private string GetProfileCommandUri(string profileName, string command)
        {
            // Get service document.
            var serviceDoc = LoadXMLFromUri("http://127.0.0.1:8580/");

            // Extract profile collection uri.
            string profileCollectionUri = GetValueFromDocumentByXPath(serviceDoc,
                "//app:service/app:workspace/app:collection[app:categories/atom:category[@term='profile']]/@href");

            // Get profile collection document.
            var profileCollectionDoc = LoadXMLFromUri(profileCollectionUri);

            // Extract profile entry uri from the given profileName.
            string profileEntryUri = GetValueFromDocumentByXPath(profileCollectionDoc,
                "//atom:feed/atom:entry[atom:title[text()='" + profileName + "']]/atom:link[@rel='self']/@href");

            // Get profile entry document.
            var profileEntryDoc = LoadXMLFromUri(profileEntryUri);

            // Extract profile command uri from the given command.
            string profileCommandUri = GetValueFromDocumentByXPath(profileEntryDoc,
                "//atom:entry/atom:link[@rel='" + command +  "']/@href");

            return profileCommandUri;
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
                client.ContentType = "text/plain";
                client.ContentLength = bodyBytes.Length;

                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);
                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }

        public void InitializeShow(string showName, string profileName)
        {
            string elementCollectionUri = GetElementCollectionUri(showName);
            string profileCommandUri = GetProfileCommandUri(profileName, "initialize");

            // POST on profile command uri with the collectionUri as a body.
            var response = PostOnUri(profileCommandUri, elementCollectionUri);
            Console.WriteLine("Response status : " + response.StatusCode + "\n");
        }

        public void TakeElement(string showName, string entryName, string profileName)
        {
            string elementEntryUri = GetElementEntryUri(showName, entryName);
            string profileCommandUri = GetProfileCommandUri(profileName, "take");

            // POST on profile command uri with the entryUri as a body.
            var response = PostOnUri(profileCommandUri, elementEntryUri);
            Console.WriteLine("Response status : " + response.StatusCode + "\n");
        }

        private XmlDocument LoadXMLFromUri(string uri)
        {
            XmlDocument doc = new XmlDocument();
            doc.Load(uri);
            return doc;
        }
    }

    // Main class is here.
    class Program
    {
        private static void Main(string[] args)
        {
            ElementExecutionExample myExample = new ElementExecutionExample();

            // Initialize the show named "My Show".
            Console.Write(
@"This is the element execution example.

To setup environment for this example:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.
3. Load Trio's show ""example_show.trioshow"" in ""TestResources"" folder
   to Viz Trio.

Press enter to initialize the show : ");
            Console.ReadLine();
            myExample.InitializeShow("My Show", "default");

            // Take the element named "One".
            Console.Write("Press enter to take the element on air : ");
            Console.ReadLine();
            myExample.TakeElement("My Show", "1000", "default");
        }
    }
}
