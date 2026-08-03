using System;
using System.Net;
using System.Text;
using System.Xml;

namespace CreatePageUsingNLESerializedObject
{
    class ElementPostingExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public ElementPostingExample()
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

        private string GetElementCollectionUriFromShow(string showName)
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

            // Extract element collection uri for show.
            string elementCollectionUri = GetValueFromDocumentByXPath(myShowDoc,
                "//atom:feed/atom:entry[atom:category[@term='element_collection']]/atom:link[@rel='alternate']/@href");

            return elementCollectionUri;
        }

        private HttpWebResponse PostNLESerializedObject(string uri, string body)
        {
            try
            {
                byte[] bodyBytes = Encoding.UTF8.GetBytes(body);

                var client = (HttpWebRequest)HttpWebRequest.Create(uri);
                client.AllowAutoRedirect = false;
                client.AllowWriteStreamBuffering = false;

                client.Method = "POST";
                client.ContentType = "application/vnd.vizrt.nle-serialized";
                client.ContentLength = bodyBytes.Length;

                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);
                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }

        public void CreatePageByUsingNLESerializedObject()
        {
            // Retrieve element collection uri in which to create a page.
            string elementCollectionUri = GetElementCollectionUriFromShow("My Show");

            string nleObject = @"
<viznle id=""viznle-09052006-130928-342"" version=""1003"" actionflags=""0"">
  <cliplength msec=""0""/>
  <page id=""grassvalley/examples/1101"" type=""trio"">
    <element name=""1101"" showautodescription=""true"" isfilescript=""false"" description=""Cat/Inspector/IMAGE*User/cat-inspector/boring-generic-name/-78/12cm/3000"" layer=""[MAIN]"" templatedescription=""LowerThird"" template=""1100"">
      <entry name=""template"">1100</entry>
      <entry name=""data"">
        <entry name=""1"" description=""First name"">
          <entry name=""1"" type=""text"" description=""First name"">Cat</entry>
          <entry name=""1.kerning"" type=""float"" description=""First name"">4.000000</entry>
        </entry>
        <entry name=""2"" description=""Last name"">
          <entry name=""2"" type=""text"" description=""Last name"">Inspector</entry>
          <entry name=""2.kerning"" type=""float"" description=""Last name"">-2.000000</entry>
        </entry>
        <entry name=""3"" description=""Picture"">
          <entry name=""3"" type=""image"" description=""Picture"">IMAGE*User/cat-inspector
          </entry>
        </entry>
        <entry name=""4"" description=""DIVISION?"">
          <entry name=""4"" type=""text"" description=""DIVISION?"">boring-generic-name</entry>
          <entry name=""4.kerning"" type=""float"" description=""DIVISION?"">0.000000</entry>
        </entry>
        <entry name=""5"" description=""KNOCK OUTS?"">
          <entry name=""5"" type=""text"" description=""KNOCK OUTS?"">-78</entry>
          <entry name=""5.kerning"" type=""float"" description=""KNOCK OUTS?"">0.000000</entry>
        </entry>
        <entry name=""6"" description=""HEIGHT?"">
          <entry name=""6"" type=""text"" description=""HEIGHT?"">12cm</entry>
          <entry name=""6.kerning"" type=""float"" description=""HEIGHT?"">0.000000</entry>
        </entry>
        <entry name=""7"" description=""WEIGHT?"">
          <entry name=""7"" type=""text"" description=""WEIGHT?"">3000</entry>
          <entry name=""7.kerning"" type=""float"" description=""WEIGHT?"">0.000000</entry>
        </entry>
      </entry>
    </element>
  </page>
  <commands type=""viz"">
    <cmd>SCENE*grassvalley/examples/1100 LOAD</cmd>
    <cmd>RENDERER SET_OBJECT SCENE*grassvalley/examples/1100</cmd>
    <cmd>RENDERER*TREE*$object*FUNCTION*ControlObject*in SET ON 1 SET Cat\\01.kerning 
      SET 4.000000\\02 SET Inspector\\02.kerning SET -2.000000\\03 
      SET IMAGE*User/cat-inspector\\04 SET boring-generic-name\\04.kerning 
      SET 0.000000\\05 SET -78\\05.kerning SET 0.000000\\06 
      SET 12cm\\06.kerning SET 0.000000\\07 SET 3000\\07.kerning SET 0.000000</cmd>
  </commands>
</viznle>";

            // POST to the element collection uri with the NLE Serialized Object
            // as a body.
            var response = PostNLESerializedObject(elementCollectionUri, nleObject);
            Console.WriteLine("Response status : " + response.StatusCode + "\n");
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine(
@"This is the CreatePageUsingNLESerializedObject example.

Please load Trio's show ""example_show.trioshow"" in ""TestResources"" folder
to Viz Trio and press enter: ");
            Console.ReadLine();

            ElementPostingExample myExample = new ElementPostingExample();
            myExample.CreatePageByUsingNLESerializedObject();
        }
    }
}
